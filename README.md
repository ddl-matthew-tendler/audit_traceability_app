# Domino Apps Guidelines

## Getting Started

### Downloading Frontend Code

To populate the `example_domino_frontend_code` folder with the latest frontend code from the repository, run:

```bash
./grab_front_end_code.sh
```

This script will:
- Clone the entire repository
- Remove git history to ensure no git continuity in the example folder
- Place all files into `example_domino_frontend_code/`

**Note:** The `example_domino_frontend_code/` folder is gitignored, so downloaded files won't be tracked in version control.

### Using with Cursor

To set up your Cursor project with all necessary files:

```bash
# Copy the frontend code (without hidden folders from within it)
cp -r example_domino_frontend_code/* /path/to/your/cursor/project/

# Copy only the root-level hidden folders and files from this project
cp -r .cursor /path/to/your/cursor/project/
cp .gitignore domino-logo.svg swagger.json /path/to/your/cursor/project/
```

Or in a single command:
```bash
cp -r example_domino_frontend_code/* /path/to/your/cursor/project/ && \
cp -r .cursor .gitignore domino-logo.svg swagger.json /path/to/your/cursor/project/
```

This ensures your Cursor project includes:
- The `frontend/` folder with all application code
- Configuration files (`Makefile`, `package.json`, `domino.yml`, etc.)
- Build and deployment files (`build/`, `dev/`, `helm/`)
- **Cursor rules** (`.cursor/`) for code analysis and completions
- **Git ignore configuration** (`.gitignore`)
- **Domino logo** for branding
- **Swagger API documentation** for reference

## Documentation

- [App Authoring Rules](app_authoring_rules.md)
- [Swagger API Documentation](swagger.json)
