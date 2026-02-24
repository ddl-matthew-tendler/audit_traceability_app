"""
Traceability Explorer - FastAPI server for Domino deployment.
- Serves static build from client/dist
- Proxies /api/audit, /api/users, /api/me to Domino with auth
- Bind 0.0.0.0:8888 for Domino
"""
import csv
import os
import sys
from pathlib import Path

import requests
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

TOKEN_URL = "http://localhost:8899/access-token"
DOMINO_API_HOST = os.environ.get("DOMINO_API_HOST", "").strip() or None
# Audit Trail API host — hardcoded for life-sciences-demo; remove to use DOMINO_API_HOST again.
AUDIT_API_HOST = os.environ.get("AUDIT_API_HOST", "https://life-sciences-demo.domino-eval.com").strip().rstrip("/")
# Audit Trail API path - Admin Guide uses /api/audittrail/v1/auditevents (tested working).
# Platform API (e.g. Domino Cloud) often uses /auditevents. Override via AUDIT_API_PATH if needed.
AUDIT_API_PATH = os.environ.get("AUDIT_API_PATH", "/api/audittrail/v1/auditevents").strip()
# If default path 404s, try these in order (Domino Cloud often exposes only the Platform path).
AUDIT_API_FALLBACK_PATHS = [
    p.strip() for p in os.environ.get("AUDIT_API_FALLBACK_PATHS", "/auditevents,/v4/auditevents").split(",")
    if p.strip()
]
# Domino Audit API max limit per request (we paginate when client asks for more).
AUDIT_API_MAX_LIMIT = int(os.environ.get("AUDIT_API_MAX_LIMIT", "1000"))
# Max total events we'll fetch via pagination (safety cap).
AUDIT_PAGINATION_CAP = int(os.environ.get("AUDIT_PAGINATION_CAP", "50000"))
RUNS_ENRICHMENT_ENABLED = os.environ.get("RUNS_ENRICHMENT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
RUNS_ENRICHMENT_MAX_RUNS = int(os.environ.get("RUNS_ENRICHMENT_MAX_RUNS", "300"))
RUNS_ENRICHMENT_TIMEOUT_SEC = int(os.environ.get("RUNS_ENRICHMENT_TIMEOUT_SEC", "10"))
# Jobs enrichment (inspired by domaudit-main professional services tool).
# Uses /v4/jobs/{jobId} + /v4/jobs/{jobId}/runtimeExecutionDetails for rich fields.
JOBS_ENRICHMENT_ENABLED = os.environ.get("JOBS_ENRICHMENT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
JOBS_ENRICHMENT_MAX = int(os.environ.get("JOBS_ENRICHMENT_MAX", "200"))
JOBS_ENRICHMENT_TIMEOUT_SEC = int(os.environ.get("JOBS_ENRICHMENT_TIMEOUT_SEC", "10"))
# Control Center bulk enrichment — single API call for date range fills duration, hardwareTier, user, project, runType.
CC_ENRICHMENT_ENABLED = os.environ.get("CC_ENRICHMENT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
CC_ENRICHMENT_TIMEOUT_SEC = int(os.environ.get("CC_ENRICHMENT_TIMEOUT_SEC", "30"))

app = FastAPI()

# Static files from client/dist (built by: npm run build)
DIST_PATH = Path(__file__).parent / "client" / "dist"
MOCK_CSV_PATH = Path(__file__).parent / "domino_audit_trail_20260211_1607.csv"


def _log(msg: str) -> None:
    """Log to stdout (Domino captures this)."""
    print(msg, flush=True)
    sys.stdout.flush()


@app.on_event("startup")
async def startup_log():
    """Emit startup diagnostics to stdout for Domino log visibility."""
    _log("=== Traceability Explorer startup ===")
    _log(f"  client/dist exists: {DIST_PATH.exists()}")
    _log(f"  client/dist/assets exists: {(DIST_PATH / 'assets').exists()}")
    _log(f"  index.html exists: {(DIST_PATH / 'index.html').exists()}")
    _log(f"  DOMINO_API_HOST set: {bool(DOMINO_API_HOST)}")
    _log(f"  AUDIT_API_HOST: {AUDIT_API_HOST}")
    _log(f"  AUDIT_API_PATH (and fallbacks on 404): {_audit_paths_to_try()}")
    if DOMINO_API_HOST:
        _log(f"  DOMINO_API_HOST: {DOMINO_API_HOST[:60]}{'...' if len(DOMINO_API_HOST) > 60 else ''}")
    _log("=== Ready for requests ===")


async def get_auth_headers(request: Request) -> dict:
    """Domino auth: get headers for outbound API calls. Re-acquire token on every call."""
    api_key = (
        os.environ.get("API_KEY_OVERRIDE")
        or os.environ.get("DOMINO_USER_API_KEY")
        or (request.headers.get("X-API-Key-Override") if request else None)
    )
    if api_key:
        return {"X-Domino-Api-Key": api_key}
    try:
        r = requests.get(TOKEN_URL, timeout=5)
        r.raise_for_status()
        token = r.text.strip()
        bearer = token if token.startswith("Bearer ") else f"Bearer {token}"
        return {"Authorization": bearer}
    except Exception as e:
        _log(f"getAuthHeaders failed: {e}")
        raise RuntimeError(f"getAuthHeaders: {e}") from e


def get_domino_host() -> str | None:
    """Return API host, normalizing apps. subdomain to root (APIs live on root domain)."""
    host = DOMINO_API_HOST
    if not host:
        return None
    host = host.rstrip("/")
    try:
        from urllib.parse import urlparse
        p = urlparse(host)
        if p.netloc and p.netloc.startswith("apps."):
            netloc = p.netloc[5:]  # strip "apps."
            return f"{p.scheme or 'https'}://{netloc}"
    except Exception:
        pass
    return host


def _normalize_audit_event(raw: dict) -> dict:
    """
    Map Admin Guide API event shape to our frontend format.
    API uses: actor.{name}, action.{eventName}, in.{name}, targets[].entity,
    affecting[] (contains environment + hardwareTier entities), timestamp.
    """
    actor = raw.get("actor") or {}
    action = raw.get("action") or {}
    context_in = raw.get("in") or {}
    targets = raw.get("targets") or []
    first_target = targets[0] if targets else {}
    entity = first_target.get("entity") or {}

    # affecting[] contains related entities: environment, hardwareTier, dataset, etc.
    affecting = raw.get("affecting") or []
    affecting_env_name = None
    affecting_hw_name = None
    affecting_hw_id = None
    for aff in affecting:
        if not isinstance(aff, dict):
            continue
        etype = (aff.get("entityType") or "").lower()
        if etype == "environment" and not affecting_env_name:
            affecting_env_name = aff.get("name")
        elif etype == "hardwaretier" and not affecting_hw_name:
            affecting_hw_name = aff.get("name")
            affecting_hw_id = aff.get("id")

    # Build unified metadata: merge from raw.metadata, targets[0].customAttributes,
    # targets[0].attributes, targets[0].properties — Domino stores "Custom Attributes"
    # (visible in the Audit Trail UI) in one of these locations.
    metadata: dict = {}
    for source in [
        raw.get("metadata"),
        first_target.get("customAttributes"),
        first_target.get("attributes"),
        first_target.get("properties"),
        entity.get("customAttributes"),
        entity.get("attributes"),
        entity.get("properties"),
    ]:
        if isinstance(source, dict):
            metadata.update(source)
        elif isinstance(source, list):
            for item in source:
                if isinstance(item, dict):
                    k = item.get("key") or item.get("name") or item.get("attribute")
                    v = item.get("value")
                    if k and v is not None:
                        metadata[str(k)] = v

    # Expand affecting[] entities into metadata (same approach as the Streamlit exporter:
    # environment_1, hardwareTier_1, dataset_1, etc.)
    type_counters: dict[str, int] = {}
    for aff in affecting:
        if not isinstance(aff, dict):
            continue
        etype = aff.get("entityType", "entity")
        aname = aff.get("name", "")
        type_counters[etype] = type_counters.get(etype, 0) + 1
        if aname:
            metadata[f"{etype}_{type_counters[etype]}"] = aname

    # Build a case-insensitive lookup: "Run Command" -> value, "run command" -> same value, etc.
    _meta_lower: dict[str, str] = {}
    for k, v in metadata.items():
        if isinstance(k, str) and isinstance(v, str) and v.strip():
            _meta_lower[k.lower().replace(" ", "").replace("_", "").replace("-", "")] = v.strip()

    def _first_non_empty(*values):
        for value in values:
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def _first_number(*values):
        for value in values:
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                try:
                    return float(value.strip())
                except ValueError:
                    continue
        return None

    def _ci(key: str) -> str | None:
        """Case-insensitive metadata lookup: normalizes key to match 'Run Command' / 'runCommand' / 'run_command' etc."""
        return _meta_lower.get(key.lower().replace(" ", "").replace("_", "").replace("-", ""))

    def _metadata_first_match(meta: dict, prefix: str):
        """Return tuple of string values from metadata keys starting with prefix (e.g. environment_1)."""
        out = []
        for k, v in meta.items():
            if isinstance(k, str) and k.startswith(prefix) and isinstance(v, str) and v.strip():
                out.append(v.strip())
        return tuple(out) if out else None

    def _deep_get(obj, *keys):
        """Walk a chain of keys into nested dicts, returning first non-empty string found."""
        for key in keys:
            if not isinstance(obj, dict):
                return None
            obj = obj.get(key)
        if isinstance(obj, str) and obj.strip():
            return obj.strip()
        return None

    # domaudit-style: extract from nested metadata objects that mirror /v4/jobs response shape.
    # Job detail payloads nest data under statuses.*, stageTime.*, environment.*, startedBy.*, etc.
    meta_statuses = metadata.get("statuses") if isinstance(metadata.get("statuses"), dict) else {}
    meta_stage_time = metadata.get("stageTime") if isinstance(metadata.get("stageTime"), dict) else {}
    meta_environment = metadata.get("environment") if isinstance(metadata.get("environment"), dict) else {}
    meta_started_by = metadata.get("startedBy") if isinstance(metadata.get("startedBy"), dict) else {}
    meta_hardware = metadata.get("hardwareTier") if isinstance(metadata.get("hardwareTier"), dict) else {}

    # Calculate duration from stageTime.completedTime - stageTime.runStartTime when no explicit duration.
    stage_duration = None
    completed_ms = meta_stage_time.get("completedTime")
    start_ms = meta_stage_time.get("runStartTime")
    if isinstance(completed_ms, (int, float)) and isinstance(start_ms, (int, float)) and completed_ms > start_ms:
        stage_duration = (completed_ms - start_ms) / 1000.0

    # Infer runType from event name when no explicit value in metadata.
    event_name = (action.get("eventName") or "").lower()
    entity_type = (entity.get("entityType") or "").lower()
    inferred_run_type = None
    if "workspace" in event_name or entity_type == "workspace":
        inferred_run_type = "Workspace"
    elif "job" in event_name or entity_type == "job":
        inferred_run_type = "Job"
    elif "app" in event_name:
        inferred_run_type = "App"
    elif "run" in event_name or entity_type == "run":
        inferred_run_type = "Run"

    # For workspace events, use the workspace name as command hint if no explicit command.
    workspace_name = entity.get("name") if entity_type == "workspace" else None

    # Event source from action.using[] (e.g. "API", "Web")
    using = action.get("using") or []
    event_source = ", ".join(u.get("id", "") for u in using if isinstance(u, dict) and u.get("id")) or None

    return {
        "id": raw.get("id"),
        "event": action.get("eventName") or raw.get("event") or "",
        "timestamp": raw.get("timestamp"),
        "actorId": actor.get("id") or actor.get("userId"),
        "actorName": _first_non_empty(
            actor.get("name"),
            _deep_get(metadata, "startedBy", "username"),
            meta_started_by.get("username"),
        ),
        "actorFirstName": actor.get("firstName"),
        "actorLastName": actor.get("lastName"),
        "targetType": entity.get("entityType") or raw.get("targetType"),
        "targetId": entity.get("id") or raw.get("targetId"),
        "targetName": entity.get("name") or raw.get("targetName"),
        "withinProjectId": context_in.get("id") or raw.get("withinProjectId"),
        "withinProjectName": context_in.get("name") or raw.get("withinProjectName"),
        "eventSource": event_source,
        "traceId": action.get("traceId"),
        "electronicallySigned": action.get("electronicallySigned"),
        "metadata": metadata,
        "command": _first_non_empty(
            raw.get("command"),
            metadata.get("Run Command"),
            metadata.get("runCommand"),
            metadata.get("command"),
            metadata.get("jobRunCommand"),
            metadata.get("commandToRun"),
            metadata.get("commandLine"),
            metadata.get("entrypoint"),
            _ci("runcommand"),
            _ci("command"),
            workspace_name,
        ),
        "status": _first_non_empty(
            raw.get("status"),
            metadata.get("Execution Status"),
            metadata.get("status"),
            metadata.get("runStatus"),
            metadata.get("executionStatus"),
            meta_statuses.get("executionStatus"),
            metadata.get("currentStatus"),
            _deep_get(metadata, "data", "currentStatus"),
            _ci("executionstatus"),
            _ci("status"),
        ),
        "durationSec": _first_number(
            raw.get("durationSec"),
            metadata.get("runDurationSec"),
            metadata.get("runDurationSeconds"),
            metadata.get("runDurationInSeconds"),
            metadata.get("Run Duration"),
            stage_duration,
        ),
        "computeTier": _first_non_empty(
            raw.get("computeTier"),
            metadata.get("computeTier"),
            metadata.get("computeSize"),
            metadata.get("tier"),
            metadata.get("machineSize"),
        ),
        "hardwareTier": _first_non_empty(
            raw.get("hardwareTier"),
            affecting_hw_name,
            metadata.get("Hardware Tier"),
            metadata.get("hardwareTierName"),
            meta_hardware.get("name") if isinstance(meta_hardware, dict) else (metadata.get("hardwareTier") if isinstance(metadata.get("hardwareTier"), str) else None),
            metadata.get("hardware"),
            _ci("hardwaretier"),
        ),
        "hardwareTierId": affecting_hw_id,
        "environmentName": _first_non_empty(
            raw.get("environmentName"),
            affecting_env_name,
            metadata.get("Environment"),
            metadata.get("environmentName"),
            meta_environment.get("environmentName"),
            metadata.get("environment") if isinstance(metadata.get("environment"), str) else None,
            metadata.get("environmentRevisionName"),
            metadata.get("environmentDisplayName"),
            _ci("environment"),
            _ci("environmentname"),
        ),
        "runId": _first_non_empty(
            raw.get("runId"),
            metadata.get("Run"),
            metadata.get("runId"),
            metadata.get("executionId"),
            entity.get("id") if (entity.get("entityType") or "").lower() in ("run", "job") else None,
            _ci("run"),
            _ci("runid"),
        ),
        "jobId": _first_non_empty(
            metadata.get("jobId"),
            metadata.get("Job"),
            entity.get("id") if (entity.get("entityType") or "").lower() == "job" else None,
            _ci("jobid"),
        ),
        "runType": _first_non_empty(
            metadata.get("Run Type"),
            metadata.get("runType"),
            metadata.get("executionType"),
            metadata.get("workloadType"),
            _ci("runtype"),
            inferred_run_type,
        ),
        "runFile": _first_non_empty(
            raw.get("runFile"),
            metadata.get("Run File"),
            metadata.get("runFile"),
            metadata.get("filename"),
            _ci("runfile"),
        ),
        "runOrigin": _first_non_empty(
            raw.get("runOrigin"),
            metadata.get("Run Origin"),
            metadata.get("runOrigin"),
            metadata.get("source"),
            _ci("runorigin"),
        ),
        "raw": {
            "id": raw.get("id"),
            "action": raw.get("action"),
            "in": raw.get("in"),
            "targets": raw.get("targets"),
            "affecting": raw.get("affecting"),
            "source": raw.get("source"),
        },
    }


def _enrich_events_with_runs(events: list[dict], headers: dict) -> list[dict]:
    """
    Optional run enrichment using Domino /v4/runs/{runId}.
    Keeps audit values when present and fills missing fields only.
    """
    if not RUNS_ENRICHMENT_ENABLED:
        return events

    base = get_domino_host()
    if not base:
        _log("RUNS_ENRICHMENT_ENABLED=true but DOMINO_API_HOST is not set; skipping enrichment.")
        return events

    run_ids: list[str] = []
    seen: set[str] = set()
    for event in events:
        run_id = event.get("runId")
        if not isinstance(run_id, str) or not run_id.strip():
            continue
        run_id = run_id.strip()
        if run_id.lower() == "unknown":
            continue
        if run_id in seen:
            continue
        seen.add(run_id)
        run_ids.append(run_id)
        if len(run_ids) >= RUNS_ENRICHMENT_MAX_RUNS:
            break

    if not run_ids:
        return events

    runs_by_id: dict[str, dict] = {}
    for run_id in run_ids:
        try:
            url = f"{base.rstrip('/')}/v4/runs/{run_id}"
            resp = requests.get(url, headers=headers, timeout=RUNS_ENRICHMENT_TIMEOUT_SEC)
            if not resp.ok:
                continue
            payload = resp.json()
            if isinstance(payload, dict):
                runs_by_id[run_id] = payload
        except Exception:
            continue

    if not runs_by_id:
        _log("Run enrichment attempted but no run details were resolved.")
        return events

    def _fill(event: dict, key: str, value):
        if event.get(key) not in (None, "", "Unknown"):
            return
        if value in (None, ""):
            return
        event[key] = value

    enriched_count = 0
    for event in events:
        run_id = event.get("runId")
        if not isinstance(run_id, str):
            continue
        run_data = runs_by_id.get(run_id)
        if not run_data:
            continue
        _fill(event, "command", run_data.get("command"))
        _fill(event, "status", run_data.get("status"))
        _fill(event, "durationSec", run_data.get("runDurationInSeconds") or run_data.get("runDurationSec"))
        _fill(event, "hardwareTier", run_data.get("hardwareTierName") or run_data.get("hardwareTier"))
        _fill(event, "withinProjectName", run_data.get("projectIdentity") or run_data.get("projectName"))
        _fill(event, "actorName", run_data.get("userName"))
        _fill(event, "targetName", run_data.get("title"))

        # Try common environment names from run payloads (RunMonolithDTO, Provenance, etc.).
        env_name = None
        if isinstance(run_data.get("environmentDetails"), dict):
            env_name = (
                run_data["environmentDetails"].get("name")
                or run_data["environmentDetails"].get("environmentName")
            )
        _fill(event, "environmentName", env_name)
        enriched_count += 1

    _log(f"Run enrichment resolved {len(runs_by_id)} run records; applied to {enriched_count} events.")
    return events


def _enrich_events_with_jobs(events: list[dict], headers: dict) -> list[dict]:
    """
    Job enrichment using /v4/jobs/{jobId} (+ runtimeExecutionDetails).
    Inspired by domaudit-main professional services tool which uses these endpoints
    to extract command, status, hardware tier, environment, timing, and user info.
    """
    if not JOBS_ENRICHMENT_ENABLED:
        return events

    base = get_domino_host()
    if not base:
        _log("JOBS_ENRICHMENT_ENABLED=true but DOMINO_API_HOST is not set; skipping.")
        return events

    job_ids: list[str] = []
    seen: set[str] = set()
    for event in events:
        jid = event.get("jobId") or ""
        if isinstance(jid, str) and jid.strip() and jid.strip().lower() != "unknown":
            jid = jid.strip()
            if jid not in seen:
                seen.add(jid)
                job_ids.append(jid)
        if len(job_ids) >= JOBS_ENRICHMENT_MAX:
            break

    if not job_ids:
        return events

    jobs_by_id: dict[str, dict] = {}
    for jid in job_ids:
        merged: dict = {}
        for path in [f"/v4/jobs/{jid}", f"/v4/jobs/{jid}/runtimeExecutionDetails"]:
            try:
                url = f"{base.rstrip('/')}{path}"
                resp = requests.get(url, headers=headers, timeout=JOBS_ENRICHMENT_TIMEOUT_SEC)
                if resp.ok:
                    payload = resp.json()
                    if isinstance(payload, dict):
                        merged.update(payload)
            except Exception:
                continue
        if merged:
            jobs_by_id[jid] = merged

    if not jobs_by_id:
        _log("Job enrichment attempted but no job details were resolved.")
        return events

    def _fill(event: dict, key: str, value):
        if event.get(key) not in (None, "", "Unknown"):
            return
        if value in (None, ""):
            return
        event[key] = value

    enriched_count = 0
    for event in events:
        jid = (event.get("jobId") or "").strip()
        if not jid:
            continue
        job = jobs_by_id.get(jid)
        if not job:
            continue

        _fill(event, "command", job.get("jobRunCommand") or job.get("command"))

        statuses = job.get("statuses") or {}
        if isinstance(statuses, dict):
            _fill(event, "status", statuses.get("executionStatus"))
        _fill(event, "status", job.get("status"))

        # Hardware tier — domaudit shows it as a direct string field
        hw = job.get("hardwareTier")
        if isinstance(hw, dict):
            _fill(event, "hardwareTier", hw.get("name") or hw.get("hardwareTierName"))
        elif isinstance(hw, str):
            _fill(event, "hardwareTier", hw)
        _fill(event, "hardwareTier", job.get("hardwareTierName"))

        # Environment — nested object with environmentName
        env = job.get("environment") or {}
        if isinstance(env, dict):
            _fill(event, "environmentName", env.get("environmentName"))

        # User
        started_by = job.get("startedBy") or {}
        if isinstance(started_by, dict):
            _fill(event, "actorName", started_by.get("username"))

        # Duration from stageTime (completedTime - runStartTime) in milliseconds
        stage_time = job.get("stageTime") or {}
        if isinstance(stage_time, dict):
            completed = stage_time.get("completedTime")
            started = stage_time.get("runStartTime")
            if isinstance(completed, (int, float)) and isinstance(started, (int, float)) and completed > started:
                _fill(event, "durationSec", (completed - started) / 1000.0)

        _fill(event, "durationSec", job.get("runDurationInSeconds"))

        # Project
        _fill(event, "withinProjectName", job.get("projectName"))
        _fill(event, "targetName", job.get("title") or job.get("name"))

        enriched_count += 1

    _log(f"Job enrichment resolved {len(jobs_by_id)} job records; applied to {enriched_count} events.")
    return events


def _enrich_events_bulk_from_control_center(events: list[dict], headers: dict) -> list[dict]:
    """
    Bulk enrichment via /controlCenter/utilization/runs (single API call for date range).
    Returns RunUtilization[] with: id, runDurationInSeconds, hardwareTierId, projectIdentity,
    startingUserFullName, runType, estimatedCost. We match by id (== runId) and fill fields.
    Also calls /hardwareTier to resolve hardwareTierId → human-readable name.
    """
    if not CC_ENRICHMENT_ENABLED:
        return events

    base = get_domino_host()
    if not base:
        return events

    timestamps = [e.get("timestamp") for e in events if isinstance(e.get("timestamp"), (int, float))]
    if not timestamps:
        return events

    from datetime import datetime, timedelta, timezone

    min_ts = min(timestamps)
    max_ts = max(timestamps)
    # Timestamps may be in ms or seconds; normalize to seconds.
    if min_ts > 1e12:
        min_ts /= 1000
        max_ts /= 1000

    start_dt = datetime.fromtimestamp(min_ts, tz=timezone.utc) - timedelta(days=1)
    end_dt = datetime.fromtimestamp(max_ts, tz=timezone.utc) + timedelta(days=1)
    start_date = start_dt.strftime("%Y%m%d")
    end_date = end_dt.strftime("%Y%m%d")

    # Step 1: Fetch hardware tier ID→name map (single call).
    hw_tier_names: dict[str, str] = {}
    try:
        hw_url = f"{base.rstrip('/')}/hardwareTier?show_archived=true"
        hw_resp = requests.get(hw_url, headers=headers, timeout=CC_ENRICHMENT_TIMEOUT_SEC)
        if hw_resp.ok:
            hw_data = hw_resp.json()
            if isinstance(hw_data, list):
                for tier in hw_data:
                    if isinstance(tier, dict) and tier.get("id") and tier.get("name"):
                        hw_tier_names[tier["id"]] = tier["name"]
            _log(f"Control Center: resolved {len(hw_tier_names)} hardware tier names.")
    except Exception as e:
        _log(f"Control Center: failed to fetch hardware tiers: {e}")

    # Step 2: Fetch runs for date range (single call, may return thousands).
    runs_by_id: dict[str, dict] = {}
    try:
        runs_url = f"{base.rstrip('/')}/controlCenter/utilization/runs"
        params = {"startDate": start_date, "endDate": end_date}
        runs_resp = requests.get(runs_url, headers=headers, params=params, timeout=CC_ENRICHMENT_TIMEOUT_SEC)
        if runs_resp.ok:
            runs_data = runs_resp.json()
            if isinstance(runs_data, list):
                for run in runs_data:
                    if isinstance(run, dict) and run.get("id"):
                        runs_by_id[run["id"]] = run
            _log(f"Control Center: fetched {len(runs_by_id)} runs for range {start_date}–{end_date}.")
        else:
            _log(f"Control Center runs API returned {runs_resp.status_code}; skipping bulk enrichment.")
            return events
    except Exception as e:
        _log(f"Control Center: failed to fetch runs: {e}")
        return events

    if not runs_by_id:
        return events

    def _fill(event: dict, key: str, value):
        if event.get(key) not in (None, "", "Unknown"):
            return
        if value in (None, ""):
            return
        event[key] = value

    enriched_count = 0
    for event in events:
        run_id = event.get("runId")
        if not isinstance(run_id, str):
            continue
        run = runs_by_id.get(run_id.strip())
        if not run:
            continue

        _fill(event, "durationSec", run.get("runDurationInSeconds"))

        hw_id = run.get("hardwareTierId")
        if isinstance(hw_id, str):
            hw_name = hw_tier_names.get(hw_id, hw_id)
            _fill(event, "hardwareTier", hw_name)
            _fill(event, "computeTier", hw_name)

        _fill(event, "withinProjectName", run.get("projectIdentity"))
        _fill(event, "actorName", run.get("startingUserFullName"))

        run_type = run.get("runType")
        if isinstance(run_type, str) and run_type.strip():
            _fill(event, "runType", run_type.strip())

        enriched_count += 1

    _log(f"Control Center bulk enrichment: matched {enriched_count}/{len(events)} events.")
    return events


def _load_mock_events(limit: int = 100) -> list[dict]:
    """Load audit events from CSV mock file. Returns list of normalized events."""
    if not MOCK_CSV_PATH.exists():
        return []
    events: list[dict] = []
    try:
        with open(MOCK_CSV_PATH, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if limit > 0 and i >= limit:
                    break
                dt_str = row.get("DATE & TIME", "").strip()
                ts = None
                if dt_str:
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                        ts = int(dt.timestamp() * 1000)
                    except Exception:
                        ts = None
                events.append({
                    "id": f"mock-{i}",
                    "event": row.get("EVENT", "").strip(),
                    "timestamp": ts,
                    "actorId": row.get("USER NAME", "").strip(),
                    "actorName": row.get("USER NAME", "").strip(),
                    "targetId": row.get("TARGET NAME", "").strip() or None,
                    "targetName": row.get("TARGET NAME", "").strip() or None,
                    "withinProjectId": row.get("PROJECT NAME", "").strip() or None,
                    "withinProjectName": row.get("PROJECT NAME", "").strip() or None,
                    "metadata": {},
                })
    except Exception as e:
        _log(f"Mock CSV load error: {e}")
    return events


@app.get("/api/audit/mock")
async def audit_mock(request: Request):
    """Serve mock audit events from CSV. Query: startTimestamp, endTimestamp (filter by time), limit (default all, max 100_000)."""
    limit = 0  # 0 = no limit, load all
    if "limit" in request.query_params:
        try:
            limit = min(int(request.query_params["limit"]), 100_000)
        except ValueError:
            pass
    start_ts = request.query_params.get("startTimestamp")
    end_ts = request.query_params.get("endTimestamp")
    events = _load_mock_events(limit=limit)
    if start_ts is not None and end_ts is not None:
        try:
            start_ms = int(start_ts)
            end_ms = int(end_ts)
            events = [e for e in events if e.get("timestamp") and start_ms <= e["timestamp"] <= end_ms]
        except ValueError:
            pass
    return JSONResponse(events)


def _sanitize_upstream_error(status_code: int, body: str | dict | None) -> str:
    """Avoid surfacing full HTML 404 pages or huge bodies to the client."""
    if body is None:
        return f"Audit API returned {status_code}"
    text = body if isinstance(body, str) else str(body)
    text = (text or "").strip()
    # Domino often returns full HTML for 404; don't send that to the UI
    if text and (
        text.lstrip().startswith("<")
        or "<!doctype" in text[:200].lower()
        or "</html>" in text.lower()
    ):
        return (
            f"Domino returned {status_code} (HTML page — audit endpoint not found). "
            "The Audit Trail API may not be enabled or may use a different path on this deployment."
        )
    if len(text) > 500:
        text = text[:500] + "..."
    return text or f"Audit API returned {status_code}"


def _audit_paths_to_try() -> list[str]:
    """Return list of paths to try: configured path first, then fallbacks."""
    primary = AUDIT_API_PATH if AUDIT_API_PATH.startswith("/") else f"/{AUDIT_API_PATH}"
    rest = [p if p.startswith("/") else f"/{p}" for p in AUDIT_API_FALLBACK_PATHS if p]
    seen = {primary}
    out = [primary]
    for p in rest:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _parse_events_from_response(data: dict | list) -> list[dict]:
    """Extract list of raw event dicts from API response (events array or {events: [...]})."""
    if isinstance(data, dict) and "events" in data:
        return list(data.get("events", []))
    if isinstance(data, list):
        return list(data)
    return []


@app.get("/api/audit")
async def audit(request: Request):
    """Proxy GET /api/audit -> AUDIT_API_HOST + path. Paginates when limit > API max (1000)."""
    base = AUDIT_API_HOST
    try:
        headers = await get_auth_headers(request)
        headers["Accept"] = "application/json"
        params = dict(request.query_params)
        try:
            requested_limit = int(params.get("limit", AUDIT_API_MAX_LIMIT))
        except (TypeError, ValueError):
            requested_limit = AUDIT_API_MAX_LIMIT
        requested_limit = max(0, min(requested_limit, AUDIT_PAGINATION_CAP))
        paths_to_try = _audit_paths_to_try()
        last_status = last_err = None
        working_path: str | None = None

        # First request: find a path that works, using limit capped at API max
        page_limit = min(requested_limit, AUDIT_API_MAX_LIMIT)
        page_params = {**params, "limit": str(page_limit), "offset": str(params.get("offset", 0))}

        for path in paths_to_try:
            url = f"{base}{path}" if path.startswith("/") else f"{base}/{path}"
            r = requests.get(url, params=page_params, headers=headers, timeout=30)
            try:
                data = r.json()
            except Exception:
                data = r.text
            if r.ok:
                working_path = path
                _log(f"GET /api/audit succeeded with path: {path}")
                break
            last_status = r.status_code
            last_err = _sanitize_upstream_error(r.status_code, data)
            _log(f"GET /api/audit {path} -> {r.status_code} {last_err[:150]}")
            if r.status_code != 404:
                break

        if working_path is None:
            err_msg = last_err or f"Audit API returned {last_status}"
            if last_status == 404 and "may not be available" not in err_msg:
                err_msg = f"{err_msg} Try AUDIT_API_PATH env or contact your admin."
            return JSONResponse({"error": err_msg}, status_code=last_status or 502)

        # Parse first page (data already from successful request in loop)
        raw_events = _parse_events_from_response(data)

        # Diagnostic: log raw structure of a sample event to identify where custom attributes live.
        import json as _json
        for _sample in raw_events[:3]:
            if isinstance(_sample, dict):
                _keys = list(_sample.keys())
                _log(f"RAW EVENT TOP-LEVEL KEYS: {_keys}")
                _targets = _sample.get("targets", [])
                if _targets and isinstance(_targets[0], dict):
                    _target_keys = list(_targets[0].keys())
                    _log(f"RAW EVENT targets[0] KEYS: {_target_keys}")
                    for _tk in _target_keys:
                        val = _targets[0][_tk]
                        if isinstance(val, dict):
                            _log(f"  targets[0][{_tk!r}] dict keys: {list(val.keys())[:20]}")
                        elif isinstance(val, list) and val:
                            _log(f"  targets[0][{_tk!r}] list[0] type={type(val[0]).__name__} keys={list(val[0].keys())[:20] if isinstance(val[0], dict) else 'n/a'}")
                _meta = _sample.get("metadata")
                if isinstance(_meta, dict):
                    _log(f"RAW EVENT metadata keys: {list(_meta.keys())[:30]}")
                    _log(f"RAW EVENT metadata sample: {_json.dumps(dict(list(_meta.items())[:10]), default=str)[:500]}")
                break

        all_events = [_normalize_audit_event(ev) for ev in raw_events if isinstance(ev, dict)]

        # Paginate if client asked for more than one page
        offset = page_limit
        while (
            requested_limit > AUDIT_API_MAX_LIMIT
            and len(all_events) < requested_limit
            and len(raw_events) >= AUDIT_API_MAX_LIMIT
            and offset < AUDIT_PAGINATION_CAP
        ):
            page_params = {**params, "limit": str(AUDIT_API_MAX_LIMIT), "offset": str(offset)}
            url = f"{base}{working_path}" if working_path.startswith("/") else f"{base}/{working_path}"
            r = requests.get(url, params=page_params, headers=headers, timeout=30)
            try:
                data = r.json()
            except Exception:
                data = r.text
            if not r.ok:
                _log(f"GET /api/audit pagination offset={offset} -> {r.status_code}")
                break
            raw_events = _parse_events_from_response(data)
            all_events.extend(_normalize_audit_event(ev) for ev in raw_events if isinstance(ev, dict))
            offset += AUDIT_API_MAX_LIMIT
            if len(raw_events) < AUDIT_API_MAX_LIMIT:
                break

        # Bulk enrichment first (cheapest: 1–2 API calls for entire date range).
        all_events = _enrich_events_bulk_from_control_center(all_events, headers)
        # Per-ID enrichment fills remaining gaps (command, environment, etc.).
        all_events = _enrich_events_with_runs(all_events, headers)
        all_events = _enrich_events_with_jobs(all_events, headers)
        _log(f"GET /api/audit returning {len(all_events)} events")
        return JSONResponse(all_events)
    except Exception as e:
        _log(f"GET /api/audit error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/health")
async def health():
    """Lightweight health check for Domino readiness probes. Returns immediately."""
    return {"status": "ok"}


@app.get("/api/audit/raw-sample")
async def audit_raw_sample(request: Request):
    """Return 5 raw (un-normalized) audit events so we can inspect the actual key structure."""
    base = AUDIT_API_HOST
    headers = await _get_auth_headers(request)
    paths = [AUDIT_API_PATH] + AUDIT_API_FALLBACK_PATHS
    for path in paths:
        url = f"{base}{path}" if path.startswith("/") else f"{base}/{path}"
        try:
            r = requests.get(url, params={"limit": "5"}, headers=headers, timeout=15)
            if r.ok:
                raw_events = _parse_events_from_response(r.json())
                return JSONResponse(raw_events[:5])
        except Exception:
            continue
    return JSONResponse({"error": "Could not fetch audit events"}, status_code=502)


@app.get("/api/test")
async def api_test(request: Request):
    """
    Run all APIs the app uses: /me, /users, /audit (with and without actorId).
    Returns JSON with pass/fail and raw responses. No UI.
    """
    import time

    base = get_domino_host()
    if not base:
        return JSONResponse({"error": "DOMINO_API_HOST not set"}, status_code=503)

    results: dict = {}
    now_ms = int(time.time() * 1000)
    week_ago_ms = now_ms - 7 * 24 * 60 * 60 * 1000
    audit_params = {"startTimestamp": week_ago_ms, "endTimestamp": now_ms, "limit": 10}

    try:
        headers = await get_auth_headers(request)
        headers["Accept"] = "application/json"
    except Exception as e:
        return JSONResponse({"error": str(e), "results": {}}, status_code=502)

    # 1. GET /me
    try:
        r = requests.get(f"{base.rstrip('/')}/v4/users/self", headers=headers, timeout=30)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        results["me"] = {"ok": r.ok, "status": r.status_code, "data": data}
    except Exception as e:
        results["me"] = {"ok": False, "error": str(e)}

    # 2. GET /users
    try:
        r = requests.get(f"{base.rstrip('/')}/v4/users", headers=headers, timeout=30)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        results["users"] = {"ok": r.ok, "status": r.status_code, "data": data}
    except Exception as e:
        results["users"] = {"ok": False, "error": str(e)}

    # 3. GET /audit (no actorId)
    path = AUDIT_API_PATH if AUDIT_API_PATH.startswith("/") else f"/{AUDIT_API_PATH}"
    audit_url = f"{base.rstrip('/')}{path}"
    try:
        r = requests.get(audit_url, params=audit_params, headers=headers, timeout=30)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        results["audit"] = {"ok": r.ok, "status": r.status_code, "params": audit_params, "data": data}
    except Exception as e:
        results["audit"] = {"ok": False, "params": audit_params, "error": str(e)}

    # 4. GET /audit (with actorId from /me)
    me_data = results.get("me", {}).get("data")
    actor_id = None
    if isinstance(me_data, dict):
        actor_id = me_data.get("id") or me_data.get("userId") or me_data.get("userName")
    if actor_id:
        try:
            params_with_actor = {**audit_params, "actorId": actor_id}
            r = requests.get(audit_url, params=params_with_actor, headers=headers, timeout=30)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
            results["audit_with_actorId"] = {
                "ok": r.ok,
                "status": r.status_code,
                "actorId": actor_id,
                "params": params_with_actor,
                "data": data,
            }
        except Exception as e:
            results["audit_with_actorId"] = {"ok": False, "actorId": actor_id, "error": str(e)}
    else:
        results["audit_with_actorId"] = {"ok": False, "error": "No actorId from /me", "me_data": me_data}

    return JSONResponse({"results": results})


@app.get("/api/users")
async def users(request: Request):
    """Proxy GET /api/users -> DOMINO_API_HOST/v4/users"""
    base = get_domino_host()
    if not base:
        return JSONResponse({"error": "DOMINO_API_HOST not set"}, status_code=503)
    try:
        headers = await get_auth_headers(request)
        headers["Accept"] = "application/json"
        url = f"{base.rstrip('/')}/v4/users"
        params = dict(request.query_params)
        r = requests.get(url, params=params, headers=headers, timeout=30)
        try:
            data = r.json()
        except Exception:
            data = r.text
        if not r.ok:
            return JSONResponse(
                {"error": data if isinstance(data, str) else str(data) or f"Users API returned {r.status_code}"},
                status_code=r.status_code,
            )
        return JSONResponse(data)
    except Exception as e:
        _log(f"GET /api/users error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/api/me")
async def me(request: Request):
    """Proxy GET /api/me -> DOMINO_API_HOST/v4/users/self"""
    base = get_domino_host()
    if not base:
        return JSONResponse({"error": "DOMINO_API_HOST not set"}, status_code=503)
    try:
        headers = await get_auth_headers(request)
        headers["Accept"] = "application/json"
        url = f"{base.rstrip('/')}/v4/users/self"
        r = requests.get(url, headers=headers, timeout=30)
        try:
            data = r.json()
        except Exception:
            data = r.text
        if not r.ok:
            return JSONResponse(
                {"error": data if isinstance(data, str) else str(data) or f"Me API returned {r.status_code}"},
                status_code=r.status_code,
            )
        return JSONResponse(data)
    except Exception as e:
        _log(f"GET /api/me error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)


# Mount static asset directory if dist exists (Vite outputs to dist/assets/)
if DIST_PATH.exists() and (DIST_PATH / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST_PATH / "assets"), name="assets")


@app.get("/{path:path}")
async def serve_spa(path: str):
    """Serve SPA: static files or index.html for client-side routing."""
    if path.startswith("api/"):
        return JSONResponse({"error": "Not found"}, status_code=404)
    full = DIST_PATH / path
    if full.is_file():
        return FileResponse(full)
    index_path = DIST_PATH / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    _log("Serving 503: client/dist not found or index.html missing. Run: npm run build")
    return JSONResponse(
        {"error": "Frontend not built. Run: npm run build and commit client/dist"},
        status_code=503,
    )
