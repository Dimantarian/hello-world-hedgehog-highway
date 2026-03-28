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
