# Domino Apps Guidelines

A starter kit for building Domino applications with Cursor, including frontend code examples, API documentation, and design system rules.

## Example Prompts

Once set up, generating Domino-styled apps is as simple as describing what you want:

> Create a domino app that uses our APIs to summarize jobs run activity with a flexible time window selector component that defaults to last 7 days. Use a summary chart and a table below.

> Build a domino app with a dashboard showing compute environment usage. Include a dropdown to filter by project, a bar chart of resource consumption, and an expandable details section for each environment.

> Create a domino app that displays model deployment status across projects. Use a card grid layout with health indicators, and add a search/filter bar at the top.

The Cursor rules handle API integration, Domino design patterns, and component styling automatically.

## Quick Start

### 1. Download Frontend Code

Download the Domino frontend code manually from:

**https://github.com/cerebrotech/frontend-web-ui-service**

1. Go to the repository URL above
2. Click the green **Code** button → **Download ZIP**
3. Extract the ZIP contents into the `example_domino_frontend_code/` folder in this project

Alternatively, using git:

```bash
git clone --depth 1 https://github.com/cerebrotech/frontend-web-ui-service.git example_domino_frontend_code
rm -rf example_domino_frontend_code/.git
```

> **Note:** The contents of `example_domino_frontend_code/` are gitignored and won't be tracked.

### 2. Copy to Your Cursor Project

#### Option A: Using Terminal

Copy all necessary files to your project:

```bash
cp -r example_domino_frontend_code/* /path/to/your/cursor/project/ && \
cp -r .cursor /path/to/your/cursor/project/ && \
cp .gitignore domino-logo.svg swagger.json governance_swagger.json /path/to/your/cursor/project/
```

#### Option B: Using macOS Finder

1. Open this folder in Finder
2. Press **`Cmd + Shift + .`** to show hidden files (the `.cursor` and `.gitignore` will appear)
3. Select and copy all the files you need to your project folder
4. Press **`Cmd + Shift + .`** again to hide hidden files when done

> **Tip:** Hidden files appear slightly dimmed in Finder when visible.


## Cursor Rules Setup

The `.cursor/rules/` folder contains two rule files:

| Rule | Auto-Applied | Description |
|------|--------------|-------------|
| `how-to-build-domino-apps.mdc` | ✅ Yes | Best practices, API guidelines, and technical constraints |
| `usability_design_principles.mdc` | ❌ No | Design system guidelines, UX principles, and component patterns |

### Applying the Usability Design Principles

The `usability_design_principles.mdc` rule is **not auto-applied** and must be manually included when you want Cursor to follow UX/design guidelines.

**To apply it in a conversation:**

1. In Cursor's chat or composer, type `@` to open the mention picker
2. Select **Files & folders**
3. Navigate to `.cursor/rules/usability_design_principles.mdc`
4. The rule will be included in that conversation's context

**Examples:**

```
@.cursor/rules/usability_design_principles.mdc

Review this component for UX issues
```

```
@.cursor/rules/usability_design_principles.mdc

Build a settings page with a form for user preferences
```

This tells Cursor to follow Domino's design system (button hierarchy, typography, spacing, error handling, etc.) whether you're building new UI, reviewing existing code, or asking for improvements.

## Traceability Explorer App

This repo includes a **Traceability Explorer** app that visualizes Domino Audit Trail events as an interactive DAG (Directed Acyclic Graph).

### Stack

- **Backend:** Python FastAPI (proxies Domino Audit Trail and v4 users APIs with auth)
- **Frontend:** React 18, Vite, Tailwind CSS, React Flow, Zustand, React Query, date-fns

Domino environments are Python-only, so the server runs with uvicorn instead of Node.js.

### Build and run

```bash
# Install dependencies (root + client)
npm install

# Build the client (required before running)
npm run build

# Start the server (serves client/dist and /api/*)
./app.sh
# or: uvicorn app:app --host 0.0.0.0 --port 8888
```

The app listens on `0.0.0.0:8888`. When running inside Domino, set `DOMINO_API_HOST`; the server uses `http://localhost:8899/access-token` for auth. For local dev without Domino, use `API_KEY_OVERRIDE` with a Domino API key.

**Optional:** Default is `/auditevents` (Domino Platform API). For on-prem, set `AUDIT_API_PATH=/api/audittrail/v1/auditevents`. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

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
