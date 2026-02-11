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
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

TOKEN_URL = "http://localhost:8899/access-token"
DOMINO_API_HOST = os.environ.get("DOMINO_API_HOST", "").strip() or None

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
    """Proxy GET /api/audit -> DOMINO_API_HOST/api/audittrail/v1/auditevents"""
    base = get_domino_host()
    if not base:
        return JSONResponse({"error": "DOMINO_API_HOST not set"}, status_code=503)
    try:
        headers = await get_auth_headers(request)
        headers["Accept"] = "application/json"
        url = f"{base.rstrip('/')}/api/audittrail/v1/auditevents"
        params = dict(request.query_params)
        r = requests.get(url, params=params, headers=headers, timeout=30)
        try:
            data = r.json()
        except Exception:
            data = r.text
        if not r.ok:
            return JSONResponse(
                {"error": data if isinstance(data, str) else str(data) or f"Audit API returned {r.status_code}"},
                status_code=r.status_code,
            )
        return JSONResponse(data)
    except Exception as e:
        _log(f"GET /api/audit error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/health")
async def health():
    """Lightweight health check for Domino readiness probes. Returns immediately."""
    return {"status": "ok"}


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
