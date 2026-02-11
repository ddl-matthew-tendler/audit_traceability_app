# Traceability Explorer – Troubleshooting

This guide helps you diagnose and fix issues when the app fails to deploy or load in Domino.

## How to Find Logs

1. **Domino run logs** – In Domino, open the run and check the **Logs** tab. All `stdout`/`stderr` from the app appears here.
2. **User output** – The main application output (startup messages, Python print statements).
3. **JSON logs** – Deployment lifecycle events (Kubernetes, readiness probes, etc.).

---

## Failure Modes & Fixes

### 1. `node: command not found` / Exit code 127

**Logs:**
```
./app.sh: line 5: node: command not found
Failed with exit code: 127
```

**Cause:** The Domino environment is Python-only and does not include Node.js. The app was trying to run a Node.js server.

**Fix:** The app uses FastAPI (Python) now. Ensure `app.sh` runs `uvicorn app:app --host 0.0.0.0 --port 8888`, not `node server/index.js`.

---

### 2. Blank white page (app loads but shows nothing)

**Symptoms:** The page loads, but the UI is blank. No errors in the browser console, or 404s for assets.

**Cause:** Domino serves the app behind a proxy at a subpath (e.g. `/run/xyz/`). The frontend used absolute paths like `/assets/...`, which resolve to the domain root instead of the app subpath, causing 404s.

**Fix:**
- Vite must use `base: './'` in `vite.config.ts`.
- API calls and asset URLs must be relative (`./api/...`, `./domino-logo.svg`).
- Rebuild: `npm run build` and commit `client/dist`.

---

### 3. `client/dist/index.html not found` / Frontend not built

**Logs:**
```
ERROR: client/dist/index.html not found. Run: npm run build
```
or
```
Frontend not built. Run: npm run build and commit client/dist
```

**Cause:** `client/dist` was not built or not committed. Domino syncs the repo; if `client/dist` is missing, the app has no frontend.

**Fix:**
1. Run `npm run build`.
2. Ensure `client/dist` is **not** ignored (`.gitignore` should have `!client/dist/`).
3. Commit and push `client/dist`:
   ```bash
   git add client/dist/
   git commit -m "Add frontend build"
   git push
   ```

---

### 4. Readiness probe failed: `connection refused` on port 8888

**Logs (JSON):**
```json
"message": "Readiness probe failed: dial tcp 100.64.x.x:8888: connect: connection refused"
```

**Cause:** The readiness probe runs before the app has finished starting. Domino runs pip install, then app.sh, then uvicorn. The probe can hit before uvicorn is listening.

**What to check:**
- If the run eventually reaches "Running" and the app loads, the probe succeeded on retry. No action needed.
- If the run keeps failing: check **User output** for the line `=== Traceability Explorer startup ===`. If you never see it, uvicorn is not starting.
- Ensure `requirements.txt` is correct and pip install completes without errors.

---

### 5. `DOMINO_API_HOST not set` / API returns 503

**Symptoms:** App loads, but shows "Unable to load audit events" or similar. API calls return 503.

**Cause:** Domino sets `DOMINO_API_HOST` when the run starts. If it’s missing, the app cannot reach the Domino APIs.

**Fix:**
- Usually automatic in Domino. If it persists, check the environment/run configuration.
- For local dev: set `API_KEY_OVERRIDE` with a Domino API key.

---

### 6a. `No target user for user auditevents`

**Symptoms:** App loads, but shows "Unable to load audit events" with the above message.

**Cause:** Domino Cloud's Platform API (`/auditevents`) may require a target user when the caller is not an admin. The API expects an `actorId` (or similar) to scope the query.

**Fix:** The app now automatically passes the current user's ID when "All users" is selected. If you still see this error:
- Ensure `/api/me` returns valid user data (visit `/test` to verify).
- Contact your Domino admin – the Audit Trail API may be restricted to admins or require a different path.

---

### 6b. `Public api endpoint '/api/audittrail/v1/auditevents' not found`

**Symptoms:** App loads, but shows "Unable to load audit events" with the above message.

**Cause:** Domino Cloud (or some deployments) may not expose the Audit Trail API through the same public API gateway. The API may be admin-only, on a different plan, or under a different path.

**Fix:**

1. **Check your Domino version and plan** – The Unified Audit Trail is available in Domino 6.0+. Access may require SysAdmin or GovernanceAdmin role ([docs](https://docs.dominodatalab.com/en/6.0/admin_guide/85fbb1/domino-unified-audit-trail/)).

2. **Try an alternate path** – Set the `AUDIT_API_PATH` environment variable in your Domino app/run config:
   - **Domino Cloud (Platform API):** `/auditevents` (default) – see [Platform API reference](https://docs.dominodatalab.com/en/latest/api_guide/8c929e/domino-platform-api-reference/#_fetchAuditEvents)
   - **On-prem (Admin Guide):** `/api/audittrail/v1/auditevents`

3. **Contact your Domino admin** – Confirm that the Audit Trail API is enabled and what path/credentials are required.

---

### 7. Auth errors (401/403) when calling Domino APIs

**Logs:**
```
getAuthHeaders failed: ...
```
or API responses with 401/403.

**Cause:** The access token from `http://localhost:8899/access-token` is invalid, expired, or unavailable.

**Fix:**
- Domino provides this endpoint inside the run. If it’s unavailable, the run may not be fully initialized.
- For local dev: use `API_KEY_OVERRIDE` with a valid Domino API key.

---

### 8. Client-side runtime errors (React crash)

**Symptoms:** Blank page with errors in the browser console (e.g. "Cannot read property of undefined").

**Cause:** JavaScript error during render. The app has an error boundary, but some errors can occur before it mounts.

**Fix:**
- Check the browser console for stack traces.
- Fix the underlying bug in the component that throws.
- Ensure API responses match the expected shape (e.g. `data` array vs. raw array).

---

## Startup Diagnostics

On startup, the app logs to stdout:

```
=== Traceability Explorer startup ===
  client/dist exists: True
  client/dist/assets exists: True
  index.html exists: True
  DOMINO_API_HOST set: True
  AUDIT_API_PATH: /auditevents
  DOMINO_API_HOST: https://...
=== Ready for requests ===
```

If any of these are `False` or missing, use the corresponding section above to fix.

---

## Pre-flight Checks (app.sh)

Before starting uvicorn, `app.sh` checks:

- `client/dist/index.html` exists
- `client/dist/assets` exists

If either is missing, the script exits with an error message. Check the **User output** logs for that message.

---

## Quick Checklist for New Deployments

1. [ ] Run `npm run build`
2. [ ] Commit `client/dist` (and ensure it’s not gitignored)
3. [ ] Push to the repo Domino syncs from
4. [ ] Use a Python environment (no Node.js required)
5. [ ] App start command: `./app.sh` (or `uvicorn app:app --host 0.0.0.0 --port 8888`)
