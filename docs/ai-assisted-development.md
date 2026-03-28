# Bonus: AI-Assisted Development with Databricks

This guide covers how to use AI coding assistants to accelerate Databricks development. These tools can scaffold projects, write deployment configs, generate application code, and debug issues - all while understanding the Databricks platform.

---

## Overview

Three mainstream AI coding assistants work well with Databricks:

| Tool | How It Works | Databricks Integration |
|------|-------------|----------------------|
| **Claude Code** | CLI tool or IDE extension | Databricks AI Dev Kit (skills + MCP server) |
| **Cursor** | AI-native code editor | Databricks AI Dev Kit (skills + MCP server) |
| **GitHub Copilot** | IDE extension (VS Code, JetBrains) | General code completion; no Databricks-specific tooling |

**Claude Code** and **Cursor** can both use the **Databricks AI Dev Kit**, which gives the AI deep knowledge of Databricks APIs, patterns, and best practices. GitHub Copilot provides general code assistance but lacks Databricks-specific context.

---

## Databricks AI Dev Kit

The AI Dev Kit is a plugin that gives your AI assistant:

- **Skills**: Curated knowledge about Databricks features (Apps, DABs, Unity Catalog, MLflow, Spark, etc.)
- **MCP Server**: A live connection to your Databricks workspace - the AI can execute SQL, check job status, read notebooks, and manage resources directly

### What's in the Kit?

When installed, you'll see these directories in your project:

```
.ai-dev-kit/          # Version and metadata
.claude/skills/       # Skill documentation (used by Claude Code)
.agents/skills/       # Skill documentation (used by Cursor)
.mcp.json             # MCP server configuration
```

The skills cover topics like:
- **databricks-app-python**: Building apps with Flask, Streamlit, Dash, FastAPI, Gradio
- **databricks-bundles**: Creating and deploying DABs
- **databricks-dbsql**: SQL warehouse features and queries
- **databricks-unity-catalog**: Data governance, system tables, volumes
- **databricks-model-serving**: Deploying ML models and AI agents
- And 30+ more

### Installing the AI Dev Kit

#### For Claude Code

```bash
# Install Claude Code (if not already installed)
npm install -g @anthropic-ai/claude-code

# In your project directory, the AI Dev Kit can be added via:
# Visit https://github.com/databricks/ai-dev-kit for installation instructions
```

Once installed, Claude Code automatically loads relevant skills when you ask about Databricks topics. For example, asking "deploy this as a Databricks App" triggers the `databricks-app-python` and `databricks-bundles` skills.

#### For Cursor

The same AI Dev Kit files work in Cursor. The `.agents/skills/` directory provides context that Cursor's AI can reference. The `.mcp.json` file configures the Databricks MCP server for direct workspace interaction.

Open your project in Cursor and the AI will have access to all skill documentation automatically.

---

## Practical Examples

### Example 1: Scaffold a New App

**Prompt**: "Create a Streamlit app that queries a Unity Catalog table and displays the results, deployed via DABs"

The AI will:
1. Create `databricks.yml` with bundle config
2. Create `resources/my_app.app.yml` with the app resource
3. Create `src/app/app.yaml` with the Streamlit command
4. Create `src/app/app.py` with Streamlit code using `databricks-sdk` for auth
5. Set up `requirements.txt` with any additional dependencies

### Example 2: Debug a Deployment

**Prompt**: "My app deployment failed, can you check the logs?"

With the MCP server connected, the AI can:
- Run `databricks apps logs <app-name>` to read logs
- Identify the error (missing dependency, wrong port, auth issue)
- Fix the code and redeploy

### Example 3: Add a Data Connection

**Prompt**: "Connect this app to a SQL warehouse and show data from the sales table"

The AI will:
- Update `app.yaml` with the warehouse environment variable
- Add the `databricks-sql-connector` to requirements
- Write the connection code using `Config()` for authentication
- Handle the query and display the results

---

## Claude Code Quick Reference

Claude Code runs in your terminal alongside your normal workflow.

```bash
# Start Claude Code in your project
claude

# Ask it to do things in natural language:
> "Deploy this app to Databricks"
> "Why is my bundle validation failing?"
> "Add a /api/health endpoint to the Flask app"
> "Show me the logs for hedgehog-highway-dev"
```

### Useful Patterns

| What You Want | What to Say |
|--------------|-------------|
| Create a new app | "Create a Streamlit app deployed via DABs" |
| Deploy | "Deploy this bundle to dev" |
| Debug | "Check the app logs and fix any errors" |
| Add data | "Connect this app to a SQL warehouse" |
| Switch framework | "Convert this Flask app to FastAPI" |
| Add a target | "Add a prod deployment target" |

### Tips

- Be specific about what framework you want (Streamlit, Dash, Flask, etc.)
- Mention "DABs" or "Asset Bundles" if you want the deployment config, not just the app code
- The AI can run Databricks CLI commands directly - ask it to deploy, check status, or read logs
- If something goes wrong, paste the error and ask "why is this failing?"

---

## Cursor Quick Reference

Cursor provides inline AI assistance as you code.

1. Open your project in Cursor
2. Use `Cmd+K` (Mac) or `Ctrl+K` (Windows) to ask the AI to generate or edit code
3. Use the chat panel for longer conversations about architecture or debugging
4. The AI Dev Kit skills in `.agents/skills/` give Cursor context about Databricks patterns

### Tips

- Cursor excels at inline code generation - start typing and let it complete
- For Databricks-specific patterns, reference the skill docs: "following the pattern in .agents/skills/databricks-app-python"
- Use the chat panel for multi-step tasks like scaffolding a full DAB project

---

## GitHub Copilot Quick Reference

Copilot works as an extension in VS Code or JetBrains.

1. Install the GitHub Copilot extension
2. Start typing code - Copilot suggests completions inline
3. Use `Ctrl+I` to open Copilot Chat for questions

### Limitations with Databricks

Copilot doesn't have the AI Dev Kit integration, so it:
- Won't automatically know Databricks-specific patterns (app.yaml format, DAB structure)
- Can't connect to your workspace to run commands
- May suggest outdated APIs or patterns

**Workaround**: Keep the Databricks docs open and paste relevant snippets into Copilot Chat for context. Or use this repo as a reference template.

---

## Which Tool Should I Use?

| Scenario | Recommended Tool |
|----------|-----------------|
| Full project scaffolding (DABs + app + deploy) | Claude Code or Cursor with AI Dev Kit |
| Quick inline code completion | GitHub Copilot or Cursor |
| Debugging deployment issues | Claude Code (can run CLI commands) |
| Learning Databricks patterns | Claude Code or Cursor (skill docs provide context) |
| Existing VS Code workflow | GitHub Copilot (lightest integration) |
| Already using Cursor | Cursor with AI Dev Kit |

The AI Dev Kit gives Claude Code and Cursor a significant advantage for Databricks-specific work. For general Python/JavaScript coding, all three tools work well.

---

## Further Reading

- [Databricks AI Dev Kit](https://github.com/databricks/ai-dev-kit)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Cursor Documentation](https://docs.cursor.com/)
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
