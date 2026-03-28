# Exercise 5: Adding a Database with Lakebase

This guide walks you through adding a **Lakebase** (managed PostgreSQL) database to your Databricks App. By the end, the game will store high scores in a real database and display a leaderboard.

This builds on the base Hedgehog Highway app from the main README. If you haven't deployed that yet, do that first.

---

## What is Lakebase?

Lakebase is Databricks' managed PostgreSQL service. It gives you a fully managed, low-latency relational database that integrates with Unity Catalog and the Databricks Apps platform.

**Why Lakebase for this exercise?**

| Question | Answer |
|----------|--------|
| What is it? | A managed PostgreSQL database running inside Databricks |
| Why not a SQL warehouse? | SQL warehouses are for analytical queries on Delta tables. Lakebase is for transactional workloads - fast reads and writes, exactly what a leaderboard needs |
| How does the app connect? | Databricks auto-injects connection details (`PGHOST`, `PGDATABASE`, etc.) as environment variables when you attach it as a resource |
| How does auth work? | The app's service principal authenticates via OAuth - no static passwords |
| What does it cost? | Smallest instance (CU_1) is ~$0.11/hour. You can stop it when not in use |

---

## What You'll Change

Here's what's different between the base app (Exercise 1-4) and the Lakebase version:

| File | What Changes | Why |
|------|-------------|-----|
| `resources/hedgehog_highway.app.yml` | Add a `resources` block pointing to the Lakebase instance | Tells Databricks to inject PG connection details into the app |
| `src/app/requirements.txt` | Add `psycopg2-binary` | PostgreSQL driver - not pre-installed in the runtime |
| `src/app/app.py` | Add database connection + API endpoints | Backend logic for reading/writing scores |
| `src/app/static/game.js` | Add username input + leaderboard fetch | Frontend sends scores and displays the leaderboard |
| `src/app/templates/index.html` | Add username field + leaderboard div | UI elements for the new features |
| `src/app/static/style.css` | Add styles for username input + leaderboard | Make the new elements look retro |

The `databricks.yml` and `src/app/app.yaml` files stay essentially the same.

---

## Step-by-Step Guide

### Step 1: Install the PostgreSQL Client

You'll need `psql` to create the database and tables.

```bash
# macOS
brew install postgresql@16

# Add to PATH (add to your .zshrc/.bashrc to make permanent)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Verify
psql --version
```

---

### Step 2: Create a Lakebase Instance

```bash
databricks database create-database-instance hedgehog-scores \
  --capacity=CU_1 \
  --enable-pg-native-login \
  --no-wait \
  -p DEFAULT
```

**What this does:**
- Creates a new PostgreSQL instance called `hedgehog-scores`
- `CU_1` is the smallest (cheapest) capacity - fine for development
- `--enable-pg-native-login` allows password-based connections (useful for local testing)
- `--no-wait` returns immediately while the instance provisions in the background

**Wait for it to be ready** (takes 1-3 minutes):

```bash
databricks database get-database-instance hedgehog-scores -p DEFAULT | grep '"state"'
```

Keep running this until you see `"state": "AVAILABLE"`.

---

### Step 3: Create the Database and Table

```bash
# Create the database
databricks psql hedgehog-scores -p DEFAULT -- -c "CREATE DATABASE hedgehog;"

# Create the table
databricks psql hedgehog-scores -p DEFAULT -- -d hedgehog -c "
CREATE TABLE IF NOT EXISTS high_scores (
    id SERIAL PRIMARY KEY,
    username VARCHAR(20) NOT NULL,
    score INTEGER NOT NULL,
    round INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);
"
```

**What this does:**
- `databricks psql` connects to your Lakebase instance using OAuth (no manual password needed)
- Creates a `hedgehog` database with a `high_scores` table
- The index on `score DESC` makes the leaderboard query fast

**Verify it worked:**

```bash
databricks psql hedgehog-scores -p DEFAULT -- -d hedgehog -c "SELECT * FROM high_scores;"
```

You should see an empty table with the correct columns.

---

### Step 4: Seed Some Test Data (Optional)

It's helpful to have some scores in the leaderboard while testing:

```bash
databricks psql hedgehog-scores -p DEFAULT -- -d hedgehog -c "
INSERT INTO high_scores (username, score, round) VALUES
  ('BADGERBOSS', 85, 2),
  ('NEWTFAN42', 70, 2),
  ('DORMOUSE', 55, 1),
  ('OTTERLYMADD', 50, 1),
  ('PIPISTRELLE', 45, 1),
  ('TOADPATROL', 40, 1),
  ('SLOWWORM', 35, 1),
  ('COPPICEQUEEN', 30, 1),
  ('SSETARGET', 25, 1),
  ('HEDGELAYER', 20, 1);
"
```

---

### Step 5: Add the Database Resource to Your DAB

Edit `resources/hedgehog_highway.app.yml` to tell Databricks about the database:

**Before:**
```yaml
resources:
  apps:
    hedgehog_highway:
      name: hedgehog-highway-${bundle.target}
      description: "Hedgehog Highway - A DEFRA Conservation Simulator"
      source_code_path: ../src/app
```

**After:**
```yaml
resources:
  apps:
    hedgehog_highway:
      name: hedgehog-highway-${bundle.target}
      description: "Hedgehog Highway - A DEFRA Conservation Simulator"
      source_code_path: ../src/app
      resources:
        - name: database
          database:
            instance_name: hedgehog-scores
            database_name: hedgehog
            permission: CAN_CONNECT_AND_CREATE
```

**What this does:**
- Declares the Lakebase database as a resource for this app
- When deployed, Databricks will automatically inject environment variables into the app:

| Variable | Value |
|----------|-------|
| `PGHOST` | The Lakebase instance hostname |
| `PGDATABASE` | `hedgehog` |
| `PGUSER` | The app's service principal ID |
| `PGPORT` | `5432` |
| `PGSSLMODE` | `require` |

**Important:** Notice there is no `PGPASSWORD`. This is deliberate - the app authenticates via OAuth, not a static password. We'll handle this in the Python code.

**Why this matters for the DAB:**
- Without this block, `databricks bundle deploy` will **remove** any resources you added manually via the UI or REST API
- The DAB is the source of truth - if it's not in the YAML, it doesn't exist after deploy

---

### Step 6: Add psycopg2 to requirements.txt

Edit `src/app/requirements.txt`:

```
psycopg2-binary
```

**Why `psycopg2-binary`?** It's the PostgreSQL driver for Python. It is **not** pre-installed in the Databricks Apps runtime (unlike Flask, Streamlit, etc.), so you must include it here. This is the most common cause of Lakebase app failures.

---

### Step 7: Update the Python Backend

Replace the contents of `src/app/app.py`:

```python
import os
import psycopg2
from flask import Flask, render_template, request, jsonify
from databricks.sdk.core import Config

app = Flask(__name__)


def get_db():
    host = os.getenv("PGHOST")
    if not host:
        raise RuntimeError("No PGHOST configured")

    # Generate OAuth token via Databricks SDK (service principal auth)
    cfg = Config()
    token = cfg.authenticate().get("Authorization", "").replace("Bearer ", "")

    return psycopg2.connect(
        host=host,
        database=os.getenv("PGDATABASE", "hedgehog"),
        user=os.getenv("PGUSER"),
        password=token,
        port=os.getenv("PGPORT", "5432"),
        sslmode=os.getenv("PGSSLMODE", "require"),
    )


def init_db():
    """Create table if it doesn't exist (idempotent)."""
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS high_scores (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(20) NOT NULL,
                    score INTEGER NOT NULL,
                    round INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_high_scores_score
                ON high_scores(score DESC)
            """)
        conn.commit()
        conn.close()
        print("[APP] Database table ready")
    except Exception as e:
        print(f"[APP] Database init skipped: {e}")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/scores", methods=["GET"])
def get_scores():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT username, score, round, created_at
                FROM high_scores
                ORDER BY score DESC
                LIMIT 10
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify([
            {"username": r[0], "score": r[1], "round": r[2], "date": r[3].isoformat()}
            for r in rows
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/scores", methods=["POST"])
def post_score():
    data = request.get_json()
    username = (data.get("username") or "ANON")[:20]
    score = int(data.get("score", 0))
    round_num = int(data.get("round", 1))

    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO high_scores (username, score, round) VALUES (%s, %s, %s)",
                (username, score, round_num),
            )
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
```

**Key things to understand:**

1. **`get_db()` uses OAuth, not a password.** Databricks injects `PGHOST`, `PGUSER`, etc. but not `PGPASSWORD`. Instead, the app uses `Config().authenticate()` from the Databricks SDK to generate a short-lived OAuth token. This is more secure than a static password.

2. **`init_db()` runs on startup.** It creates the table if it doesn't exist, making the app self-bootstrapping. This is idempotent - safe to run multiple times.

3. **Two API endpoints:**
   - `GET /api/scores` - returns the top 10 scores as JSON
   - `POST /api/scores` - inserts a new score

4. **The `Config()` object auto-detects credentials.** When running in Databricks Apps, it picks up the `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET` injected by the platform. You don't configure anything.

---

### Step 8: Update the Frontend

These changes add a username input on the title screen, submit scores to the API on game over, and display the leaderboard.

**`src/app/templates/index.html`** - Add a username input inside the title screen div, before the "PRESS SPACE" text:

```html
<div id="username-input">
    <label for="username-field" class="username-label">ENTER YOUR NAME:</label>
    <input type="text" id="username-field" maxlength="12" placeholder="HEDGEHOG"
           autocomplete="off" spellcheck="false">
</div>
```

Replace the game over div's content to include a leaderboard:

```html
<div id="gameover-screen" class="overlay hidden">
    <h2>GAME OVER</h2>
    <p id="go-hedgehogs-saved"></p>
    <p id="go-final-score"></p>
    <p id="go-message" class="go-quip"></p>
    <div id="leaderboard">
        <p class="lb-title">HIGH SCORES</p>
        <div id="lb-entries"></div>
    </div>
    <p class="blink">PRESS SPACE TO TRY AGAIN</p>
</div>
```

**`src/app/static/game.js`** - The key changes:

1. Add a `playerName` variable at the top of the state section
2. In `startGame()`, read the username from the input field
3. Replace the `gameOver()` function to submit the score and fetch the leaderboard:

```javascript
function gameOver() {
    state.screen = 'GAME_OVER';
    playGameOver();
    hideMessages();

    // Update UI
    document.getElementById('go-hedgehogs-saved').textContent =
        `Hedgehogs saved: ${Math.floor(state.score / 50)}`;
    document.getElementById('go-final-score').textContent =
        `Final score: ${state.score}`;
    document.getElementById('go-message').textContent = randomFrom(GAMEOVER_MESSAGES);
    document.getElementById('lb-entries').innerHTML =
        '<p style="font-size:5px;color:#666">Loading...</p>';
    document.getElementById('gameover-screen').classList.remove('hidden');

    // Submit score, then fetch leaderboard
    submitScore(playerName, state.score, state.round)
        .then(() => fetchLeaderboard());
}

function submitScore(username, score, round) {
    return fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score, round }),
    }).catch(() => {});
}

function fetchLeaderboard() {
    fetch('/api/scores')
        .then(r => r.json())
        .then(scores => {
            const el = document.getElementById('lb-entries');
            if (!scores.length) {
                el.innerHTML = '<p style="font-size:5px;color:#666">No scores yet!</p>';
                return;
            }
            el.innerHTML = scores.map((s, i) =>
                `<div class="lb-row${s.username === playerName ? ' you' : ''}">` +
                `<span class="lb-rank">${i + 1}.</span>` +
                `<span class="lb-name">${s.username}</span>` +
                `<span class="lb-score">${s.score}</span></div>`
            ).join('');
        })
        .catch(() => {
            document.getElementById('lb-entries').innerHTML =
                '<p style="font-size:5px;color:#666">Offline</p>';
        });
}
```

The full modified files are available on the `feature/lakebase-high-scores` branch.

---

### Step 9: Deploy

```bash
# Validate first
databricks bundle validate -t dev

# Deploy
databricks bundle deploy -t dev

# Start the app
databricks bundle run hedgehog_highway -t dev
```

---

### Step 10: Verify

```bash
# Check the app is running
databricks apps get hedgehog-highway-dev
```

Open the URL in your browser. You should see:

1. A username input field on the title screen
2. After playing, a leaderboard on the game over screen showing the top 10 scores
3. Your score added to the leaderboard in real time

**Test the API directly:**

```bash
# Fetch scores
curl -s https://<your-app-url>/api/scores \
  -H "Authorization: Bearer $(databricks auth token --profile DEFAULT -o json | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")" \
  | python3 -m json.tool
```

---

## Understanding the Authentication Flow

This is the most important concept in this exercise. Here's what happens when the app connects to Lakebase:

```
┌─────────────────────┐
│   Databricks Apps   │
│     Platform        │
└────────┬────────────┘
         │ Injects env vars on startup:
         │   DATABRICKS_CLIENT_ID = <service principal ID>
         │   DATABRICKS_CLIENT_SECRET = <secret>
         │   PGHOST = <lakebase hostname>
         │   PGUSER = <service principal ID>
         │   PGDATABASE = hedgehog
         │   PGPORT = 5432
         ▼
┌─────────────────────┐
│     Your App        │
│    (app.py)         │
│                     │
│  1. Config() reads  │
│     CLIENT_ID and   │
│     CLIENT_SECRET   │
│                     │
│  2. authenticate()  │──────► Databricks OAuth endpoint
│     gets a token    │◄────── Returns Bearer token
│                     │
│  3. psycopg2 uses   │
│     token as the    │──────► Lakebase (PostgreSQL)
│     PG password     │◄────── Query results
└─────────────────────┘
```

**Key points:**
- There is **no static password** stored anywhere
- The OAuth token is short-lived and auto-refreshed
- `Config()` auto-detects the service principal credentials from the environment
- The same service principal ID is used as both the Databricks client and the PostgreSQL username

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `fe_sendauth: no password supplied` | App is trying to connect without an OAuth token | Make sure `app.py` uses `Config().authenticate()` to get a token, not `os.getenv("PGPASSWORD")` |
| `Role <id> not found in instance` | App's service principal doesn't have access to the Lakebase instance | The DAB resource block should handle this, but you can manually grant: `databricks psql <instance> -- -c "CREATE ROLE \"<sp-id>\" LOGIN;"` |
| `ModuleNotFoundError: psycopg2` | Missing from requirements.txt | Add `psycopg2-binary` to `src/app/requirements.txt` |
| `No PGHOST configured` | Database resource not attached to the app | Check `resources/hedgehog_highway.app.yml` has the `resources` block |
| Bundle deploy removes the resource | Resource was added via UI/API but not in the DAB YAML | Always define resources in the DAB YAML - it's the source of truth |
| Empty leaderboard after deploy | Table doesn't exist in the new instance | The app's `init_db()` creates it on startup, or run the CREATE TABLE manually via `databricks psql` |
| Scores show on API but not in game | JavaScript error | Open browser DevTools (F12) and check the Console tab |

---

## What You've Learned

By completing this exercise, you now understand:

1. **What Lakebase is** - Managed PostgreSQL for transactional workloads inside Databricks
2. **How to create and manage instances** - `databricks database create-database-instance`, `databricks psql`
3. **How DAB resources work** - Declaring database resources in YAML so they persist across deploys
4. **How app authentication works** - Service principal OAuth via `Config().authenticate()`, not static passwords
5. **The auto-injected environment variables** - `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPORT` (but not `PGPASSWORD`)
6. **Why `requirements.txt` matters** - `psycopg2-binary` is not pre-installed

---

## Cleaning Up

```bash
# Stop the Lakebase instance (saves cost, keeps data)
databricks database update-database-instance hedgehog-scores "stopped" \
  --stopped -p DEFAULT

# Or delete it entirely (destroys all data)
databricks database delete-database-instance hedgehog-scores -p DEFAULT
```

---

## Further Reading

- [Lakebase Documentation](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/lakebase)
- [Databricks Apps Resources](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources)
- [Apps Cookbook - Lakebase recipes](https://apps-cookbook.dev/)
