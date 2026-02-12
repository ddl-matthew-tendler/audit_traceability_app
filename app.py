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
# Audit Trail API path - Admin Guide uses /api/audittrail/v1/auditevents (tested working).
# Platform API uses /auditevents; override via AUDIT_API_PATH if needed.
AUDIT_API_PATH = os.environ.get("AUDIT_API_PATH", "/api/audittrail/v1/auditevents").strip()

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
    _log(f"  AUDIT_API_PATH: {AUDIT_API_PATH}")
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
    API uses: actor.{name}, action.{eventName}, in.{name}, targets[].entity, timestamp.
    """
    actor = raw.get("actor") or {}
    action = raw.get("action") or {}
    context_in = raw.get("in") or {}
    targets = raw.get("targets") or []
    first_target = targets[0] if targets else {}
    entity = first_target.get("entity") or {}

    return {
        "id": raw.get("id"),
        "event": action.get("eventName") or raw.get("event") or "",
        "timestamp": raw.get("timestamp"),
        "actorId": actor.get("id") or actor.get("userId"),
        "actorName": actor.get("name"),
        "targetType": entity.get("entityType") or raw.get("targetType"),
        "targetId": entity.get("id") or raw.get("targetId"),
        "targetName": entity.get("name") or raw.get("targetName"),
        "withinProjectId": context_in.get("id") or raw.get("withinProjectId"),
        "withinProjectName": context_in.get("name") or raw.get("withinProjectName"),
        "metadata": raw.get("metadata") or {},
    }


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


@app.get("/api/audit")
async def audit(request: Request):
    """Proxy GET /api/audit -> DOMINO_API_HOST + AUDIT_API_PATH"""
    base = get_domino_host()
    if not base:
        return JSONResponse({"error": "DOMINO_API_HOST not set"}, status_code=503)
    try:
        headers = await get_auth_headers(request)
        headers["Accept"] = "application/json"
        path = AUDIT_API_PATH if AUDIT_API_PATH.startswith("/") else f"/{AUDIT_API_PATH}"
        url = f"{base.rstrip('/')}{path}"
        params = dict(request.query_params)
        r = requests.get(url, params=params, headers=headers, timeout=30)
        try:
            data = r.json()
        except Exception:
            data = r.text
        if not r.ok:
            err_msg = data if isinstance(data, str) else str(data) or f"Audit API returned {r.status_code}"
            _log(f"GET /api/audit upstream error: {r.status_code} {err_msg[:200]}")
            # Surface common Domino Cloud error with actionable hint
            if "not found" in str(err_msg).lower() or r.status_code == 404:
                err_msg = (
                    f"{err_msg} "
                    "The Audit Trail API may not be available on this Domino deployment "
                    "(e.g. Domino Cloud, plan, or admin-only). Try AUDIT_API_PATH env or contact your admin."
                )
            return JSONResponse({"error": err_msg}, status_code=r.status_code)

        # Admin Guide API returns {"events": [...]}; normalize to our format
        if isinstance(data, dict) and "events" in data:
            events = data.get("events", [])
            normalized = [_normalize_audit_event(ev) for ev in events if isinstance(ev, dict)]
            return JSONResponse(normalized)
        if isinstance(data, list):
            return JSONResponse([_normalize_audit_event(ev) for ev in data if isinstance(ev, dict)])
        return JSONResponse(data)
    except Exception as e:
        _log(f"GET /api/audit error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/health")
async def health():
    """Lightweight health check for Domino readiness probes. Returns immediately."""
    return {"status": "ok"}


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
