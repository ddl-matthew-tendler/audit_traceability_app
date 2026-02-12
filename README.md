#
## Usage Trends App

This repo includes **Usage Trends**, a management-focused dashboard that turns Domino audit trail data into adoption and usage metrics. It helps business owners and managers see how much Domino is being used over time without digging into raw audit logs.

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