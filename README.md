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

When moving the downloaded code into a Cursor project, make sure to include the `.cursor` rules folder (which is hidden on macOS):

**On macOS:**
```bash
# Show hidden files in Finder
Command + Shift + .

# Or copy via terminal
cp -r example_domino_frontend_code/.cursor /path/to/your/cursor/project/
```

The `.cursor` folder contains configuration and rules that Cursor uses for code analysis and completions. Without it, you'll lose important context and custom rules.

## Documentation

- [App Authoring Rules](app_authoring_rules.md)
- [Swagger API Documentation](swagger.json)
