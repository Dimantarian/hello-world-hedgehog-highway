from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# In-memory high scores list
high_scores = []
_next_id = 0


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/scores", methods=["GET"])
def get_scores():
    top = sorted(high_scores, key=lambda s: s["score"], reverse=True)[:10]
    return jsonify(top)


@app.route("/api/scores", methods=["POST"])
def post_score():
    global _next_id
    data = request.get_json()
    username = (data.get("username") or "ANON")[:20]
    score = int(data.get("score", 0))
    round_num = int(data.get("round", 1))

    _next_id += 1
    entry = {
        "id": _next_id,
        "username": username,
        "score": score,
        "round": round_num,
        "date": datetime.now().isoformat(),
    }
    high_scores.append(entry)
    return jsonify({"ok": True, "id": _next_id})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
