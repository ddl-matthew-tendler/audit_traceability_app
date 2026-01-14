# Domino Apps Guidelines

A starter kit for building Domino applications with Cursor, including frontend code examples, API documentation, and design system rules.

## Quick Start

### 1. Download Frontend Code

Run the script to populate `example_domino_frontend_code/` with the latest frontend code:

```bash
./grab_front_end_code.sh
```

This clones the repository (without git history) into `example_domino_frontend_code/`.

> **Note:** The `example_domino_frontend_code/` folder is gitignored and won't be tracked.

### 2. Copy to Your Cursor Project

Copy all necessary files to your project:

```bash
cp -r example_domino_frontend_code/* /path/to/your/cursor/project/ && \
cp -r .cursor /path/to/your/cursor/project/ && \
cp .gitignore domino-logo.svg swagger.json governance_swagger.json /path/to/your/cursor/project/
```

This gives your project:

| Files | Description |
|-------|-------------|
| `frontend/` | Application code |
| `Makefile`, `package.json`, `domino.yml` | Configuration files |
| `build/`, `dev/`, `helm/` | Build and deployment files |
| `.cursor/rules/` | Cursor rules for code analysis |
| `swagger.json`, `governance_swagger.json` | API documentation |
| `domino-logo.svg` | Branding assets |
| `.gitignore` | Git ignore configuration |

## Documentation

### Cursor Rules (`.cursor/rules/`)

- **[how-to-build-domino-apps.mdc](.cursor/rules/how-to-build-domino-apps.mdc)** - Best practices, API guidelines, and technical constraints for building Domino apps
- **[usability_design_principles.mdc](.cursor/rules/usability_design_principles.mdc)** - Design system guidelines, UX principles, and component patterns

### API Reference

- **[swagger.json](swagger.json)** - Main API documentation
- **[governance_swagger.json](governance_swagger.json)** - Governance API documentation
