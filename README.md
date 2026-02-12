#
## Usage Patterns App

This repo includes **Usage Patterns**, a management-focused dashboard that turns Domino audit trail data into adoption and usage metrics. It helps business owners and managers see how much Domino is being used over time without digging into raw audit logs.

### What it does

- **Overview** — Key metrics (total events, active users, active projects) with period-over-period comparison, plus Usage over time and Peak activity hours charts.
- **Usage over time** — Column chart of events; x-axis aligned with the selected time filter (e.g. 7 days → 7 bars, 30 days → 30 bars).
- **Stacked by project** — Stacked area chart: X = time (aligned with filter), Y = events, with one band per project.
- **Users per project** — Line chart: X = time (aligned with filter), Y = unique users per project.
- **By project** — Horizontal bar chart of total events per project.
- **Event types** — Table of event type counts with share and distribution.

Time range defaults to **Last 7 days**. Options: All time, Today, Last 24h, Last 7 days, Last 30 days, or Custom. Use **Demo data** from a CSV or live data from the Domino Audit Trail API.

### Tech stack

- **Backend:** Python 3, FastAPI, uvicorn (Domino-compatible; no Node.js at runtime). Proxies Domino Audit Trail API; supports API key or Domino session token.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS. State: Zustand, TanStack React Query. Charts: Highcharts with Domino accent colors.

Domino environments are Python-only, so the server runs with uvicorn instead of Node.js.

### Build and run

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install client deps and build frontend (Node.js required)
npm install
npm run build

# Start the server (serves client/dist and /api/*)
./app.sh
# or: uvicorn app:app --host 0.0.0.0 --port 8888
```

The app listens on `0.0.0.0:8888`. When running inside Domino, set `DOMINO_API_HOST`; the server uses `http://localhost:8899/access-token` for auth. For local dev without Domino, use `API_KEY_OVERRIDE` with a Domino API key.

**Optional:** Default is `/api/audittrail/v1/auditevents` (Admin Guide API). For Platform API, set `AUDIT_API_PATH=/auditevents`. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### Deploy on Domino (e.g. se-demo.domino.tech)

1. **Build the client** (`npm run build`) and **commit `client/dist`** before pushing. Domino uses Python-only environments, so the frontend must be pre-built.
2. Use `app.sh` as the app start command; the app binds to port 8888 and uses relative URLs for API and assets.

**If the app fails to load or deploy**, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common failure modes and how to diagnose them from Domino logs.

### API test endpoint

To test the APIs without building the frontend, use **`./test_app.sh`** as the app start command in Domino. Then **GET `/api/test`** to run all API tests and receive JSON results (no UI).

Alternatively, when the full app is running, **GET `/api/test`** to run the same tests.

## API Reference

- **[swagger.json](swagger.json)** - Main API documentation
- **[governance_swagger.json](governance_swagger.json)** - Governance API documentation
