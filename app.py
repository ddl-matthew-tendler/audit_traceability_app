"""
Traceability Explorer - FastAPI server for Domino deployment.
- Serves static build from client/dist
- Proxies /api/audit, /api/users, /api/me to Domino with auth
- Bind 0.0.0.0:8888 for Domino
"""
import os
import sys
from pathlib import Path

import requests
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

TOKEN_URL = "http://localhost:8899/access-token"
DOMINO_API_HOST = os.environ.get("DOMINO_API_HOST", "").strip() or None
# Audit Trail API path - Domino Platform API (Cloud) uses /auditevents per
# https://docs.dominodatalab.com/en/latest/api_guide/8c929e/domino-platform-api-reference/#_fetchAuditEvents
# Admin Guide uses /api/audittrail/v1/auditevents for on-prem; override via env if needed
AUDIT_API_PATH = os.environ.get("AUDIT_API_PATH", "/auditevents").strip()

app = FastAPI()

# Static files from client/dist (built by: npm run build)
DIST_PATH = Path(__file__).parent / "client" / "dist"


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
    api_key = os.environ.get("API_KEY_OVERRIDE") or (
        request.headers.get("X-API-Key-Override") if request else None
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
    return DOMINO_API_HOST


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
        return JSONResponse(data)
    except Exception as e:
        _log(f"GET /api/audit error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/health")
async def health():
    """Lightweight health check for Domino readiness probes. Returns immediately."""
    return {"status": "ok"}


# Inline test page HTML - minimal API tester for debugging
_TEST_HTML = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>API Test - Traceability</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    .test { margin: 1rem 0; padding: 1rem; border: 1px solid #ccc; border-radius: 6px; }
    .test h2 { margin: 0 0 0.5rem; font-size: 1rem; }
    .ok { border-color: #28a464; background: #f0fff4; }
    .fail { border-color: #c20a29; background: #fff0f2; }
    .pending { border-color: #ccc; background: #fafafa; }
    pre { margin: 0.5rem 0; padding: 0.5rem; background: #f5f5f5; overflow-x: auto; font-size: 12px; }
    button { padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>API Test – Traceability Explorer</h1>
  <p>Run these tests and report back any errors. Same APIs as the main app.</p>
  <button onclick="runAll()">Run All Tests</button>
  <div id="results"></div>
  <script>
    const api = new URL('./api', window.location.href).pathname;

    async function run(name, fn) {
      const div = document.getElementById(name);
      div.className = 'test pending';
      div.querySelector('.out').textContent = 'Running...';
      try {
        const result = await fn();
        div.className = 'test ok';
        div.querySelector('.out').textContent = JSON.stringify(result, null, 2);
      } catch (e) {
        div.className = 'test fail';
        div.querySelector('.out').textContent = e.message || String(e);
      }
    }

    async function runAll() {
      const r = document.getElementById('results');
      r.innerHTML = `
        <div class="test pending" id="test1">
          <h2>1. GET /api/me (current user)</h2>
          <pre class="out">-</pre>
        </div>
        <div class="test pending" id="test2">
          <h2>2. GET /api/users (list users)</h2>
          <pre class="out">-</pre>
        </div>
        <div class="test pending" id="test3">
          <h2>3. GET /api/audit (last 7 days)</h2>
          <pre class="out">-</pre>
        </div>
        <div class="test pending" id="test4">
          <h2>4. GET /api/audit (with actorId from /me)</h2>
          <pre class="out">-</pre>
        </div>
      `;

      let meData = null;
      await run('test1', async () => {
        const res = await fetch(api + '/me');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
        meData = data;
        return data;
      });

      await run('test2', async () => {
        const res = await fetch(api + '/users');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
        return Array.isArray(data) ? data : (data.data || data.users || data);
      });

      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      await run('test3', async () => {
        const url = api + '/audit?startTimestamp=' + weekAgo + '&endTimestamp=' + now + '&limit=10';
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
        return Array.isArray(data) ? data : (data.data || data.events || data);
      });

      const actorId = meData?.id || meData?.userId || meData?.userName;
      await run('test4', async () => {
        let url = api + '/audit?startTimestamp=' + weekAgo + '&endTimestamp=' + now + '&limit=10';
        if (actorId) url += '&actorId=' + encodeURIComponent(actorId);
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
        return Array.isArray(data) ? data : (data.data || data.events || data);
      });
    }
  </script>
</body>
</html>
"""


@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Simple API test page – run in Domino and report results to debug the main app."""
    return _TEST_HTML


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
