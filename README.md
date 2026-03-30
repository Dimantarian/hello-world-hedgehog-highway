# Hedgehog Highway: Databricks Apps Getting Started Guide

A hands-on learning exercise for deploying applications to **Databricks Apps** using **Databricks Asset Bundles (DABs)**.

The app itself is deliberately simple - a retro browser game served by Flask. The focus of this guide is on understanding the deployment workflow: how DABs structure a project, how `app.yaml` configures the runtime, and how to go from local code to a live Databricks App.

---

## Prerequisites

- A Databricks workspace with Apps enabled
- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html) installed and authenticated (`databricks auth login`)
- Python 3.11+ (for local testing)

---

## Project Structure

```
.
├── databricks.yml                    # DAB configuration (bundle name, targets)
├── resources/
│   └── hedgehog_highway.app.yml      # App resource definition
└── src/
    └── app/
        ├── app.yaml                  # Databricks Apps runtime config
        ├── app.py                    # Flask application (serves static files)
        ├── requirements.txt          # Additional Python dependencies
        ├── static/
        │   ├── style.css             # Frontend styling
        │   └── game.js              # Frontend logic
        └── templates/
            └── index.html            # HTML page
```

### Key Files Explained

| File | Purpose |
|------|---------|
| `databricks.yml` | The **bundle manifest**. Defines the bundle name, includes resource files, and sets up deployment targets (e.g. `dev`, `prod`). |
| `resources/hedgehog_highway.app.yml` | Declares the app as a **DAB resource** - its name, description, and where the source code lives. |
| `src/app/app.yaml` | Tells the Databricks Apps **runtime** how to start your app. This is where you set the command (e.g. `gunicorn`) and environment variables. |
| `src/app/app.py` | Your actual application code. This example uses Flask to serve a static HTML game, but this could be Streamlit, Dash, FastAPI, or Gradio. |
| `src/app/requirements.txt` | Any Python packages beyond what's pre-installed in the runtime. Flask is pre-installed, so this is empty here. |

---

## Quick Start

### 1. Clone and Explore

```bash
git clone <this-repo>
cd ai-app-dev-hello-world
```

Take a moment to read through the files above. The entire deployment configuration is under 20 lines of YAML.

### 2. Test Locally

```bash
cd src/app
pip install flask
python app.py
```

Open http://localhost:8000 in your browser. You should see the game.

### 3. Validate the Bundle

```bash
databricks bundle validate -t dev
```

This checks your YAML configuration is valid before deploying. You should see `Validation OK!`.

### 4. Deploy

```bash
databricks bundle deploy -t dev
```

This uploads your source code and resource definitions to the workspace.

### 5. Start the App

```bash
databricks bundle run hedgehog_highway -t dev
```

This triggers the app to build and start. First deploy takes 2-3 minutes while compute spins up.

### 6. Check Status

```bash
databricks apps get hedgehog-highway-dev
```

Look for `"state": "RUNNING"` and note the `url` field - that's your live app.

### 7. View Logs

```bash
databricks apps logs hedgehog-highway-dev
```

Useful for debugging. Look for `[APP]` lines (your code's output) and `[SYSTEM]` lines (deployment status).

### 8. Tear Down

```bash
databricks bundle destroy -t dev
```

This removes the app and cleans up deployed resources.

---

## Understanding DABs

**Databricks Asset Bundles** are a way to define, deploy, and manage Databricks resources (apps, jobs, pipelines, dashboards) as code.

### Why DABs?

- **Version control**: Your deployment config lives alongside your code in git
- **Multi-environment**: Define `dev`, `staging`, `prod` targets with different settings
- **Reproducible**: Anyone with access can deploy the same bundle
- **CI/CD ready**: `databricks bundle deploy` integrates into any pipeline

### The Three Layers

```
databricks.yml          → "What bundle is this? Where does it deploy?"
resources/*.yml         → "What Databricks resources does it contain?"
src/app/app.yaml        → "How does the app actually run?"
```

**Layer 1 - Bundle config** (`databricks.yml`):
```yaml
bundle:
  name: hedgehog-highway      # Unique name for this bundle

include:
  - resources/*.yml            # Pull in resource definitions

targets:
  dev:                         # Deployment target
    default: true
    mode: development
    workspace:
      profile: DEFAULT         # Which Databricks CLI profile to use
```

**Layer 2 - Resource definition** (`resources/hedgehog_highway.app.yml`):
```yaml
resources:
  apps:
    hedgehog_highway:                          # Resource key (used in CLI commands)
      name: hedgehog-highway-${bundle.target}  # App name (includes target for uniqueness)
      description: "My application"
      source_code_path: ../src/app             # Where the app code lives
```

**Layer 3 - App runtime** (`src/app/app.yaml`):
```yaml
command:                       # How to start the app
  - "gunicorn"
  - "app:app"
  - "-w"
  - "2"
  - "-b"
  - "0.0.0.0:8000"

env:                           # Environment variables (optional)
  - name: MY_SETTING
    value: "something"
```

---

## Exercises

### Exercise 1: Change the App

Modify `src/app/templates/index.html` or `src/app/static/game.js`, then redeploy:

```bash
databricks bundle deploy -t dev
databricks bundle run hedgehog_highway -t dev
```

Observe how only changed files are re-uploaded.

### Exercise 2: Add a Second Target

Add a `prod` target to `databricks.yml`:

```yaml
targets:
  dev:
    default: true
    mode: development
    workspace:
      profile: DEFAULT
  prod:
    mode: production
    workspace:
      profile: DEFAULT      # Could be a different workspace
```

Deploy to prod:
```bash
databricks bundle deploy -t prod
databricks bundle run hedgehog_highway -t prod
```

Notice the app is named `hedgehog-highway-prod` (the `${bundle.target}` variable).

### Exercise 3: Switch Framework

Replace Flask with Streamlit. Create `src/app/app_streamlit.py`:

```python
import streamlit as st

st.set_page_config(page_title="Hello DEFRA", layout="centered")
st.title("Hello from Databricks Apps!")
st.write("This is a Streamlit app deployed via DABs.")
```

Update `src/app/app.yaml`:
```yaml
command:
  - "streamlit"
  - "run"
  - "app_streamlit.py"
```

Deploy and see the difference. Streamlit, Dash, Gradio, Flask, and FastAPI are all pre-installed.

### Exercise 4: Add Environment Variables

Apps often need to connect to data. Add a SQL warehouse connection to `src/app/app.yaml`:

```yaml
command:
  - "gunicorn"
  - "app:app"
  - "-w"
  - "2"
  - "-b"
  - "0.0.0.0:8000"

env:
  - name: DATABRICKS_WAREHOUSE_ID
    valueFrom: sql-warehouse       # References a resource added via the UI
```

The `valueFrom` pattern lets you reference Databricks resources without hardcoding IDs.

### Exercise 5: Add a Database with Lakebase

This is a bigger exercise with its own dedicated guide. Follow **[docs/adding-lakebase.md](docs/adding-lakebase.md)** to:

- Create a Lakebase (managed PostgreSQL) instance
- Add a high scores table
- Connect the app to the database via the DAB resource system
- Handle authentication using OAuth and the Databricks SDK

This exercise demonstrates how to go from a static app to one backed by a real database - a common next step for any Databricks App.

---

## Common Commands Reference

| Command | What It Does |
|---------|-------------|
| `databricks bundle validate` | Check config is valid |
| `databricks bundle deploy -t dev` | Upload code and deploy resources |
| `databricks bundle run <resource_key> -t dev` | Start/restart the app |
| `databricks apps get <app-name>` | Check app status and URL |
| `databricks apps logs <app-name>` | View app logs |
| `databricks bundle destroy -t dev` | Remove all deployed resources |

---

## Pre-installed Frameworks

The Databricks Apps runtime (Python 3.11, Ubuntu 22.04) comes with these frameworks ready to use:

| Framework | Version | Best For |
|-----------|---------|----------|
| Flask | 3.0.3 | REST APIs, lightweight web apps |
| Streamlit | 1.38.0 | Data apps, rapid prototyping |
| Dash | 2.18.1 | Interactive dashboards |
| Gradio | 4.44.0 | ML demos, chat UIs |
| FastAPI | 0.115.0 | Async APIs, auto-generated docs |

You do **not** need to add these to `requirements.txt`. Only add packages that aren't pre-installed.

---

## Further Reading

- [Databricks Apps Documentation](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/)
- [Databricks Asset Bundles](https://docs.databricks.com/dev-tools/bundles/)
- [Apps Cookbook (code examples)](https://apps-cookbook.dev/)
- [DAB Examples Repository](https://github.com/databricks/bundle-examples)
