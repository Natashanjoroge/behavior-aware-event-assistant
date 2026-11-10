import os
import psycopg
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from routes.events import events_bp
from routes.auth import auth_bp
from routes.preference import preferences_bp
from routes.bookmarks import bookmarks_bp
from routes.interactions import interactions_bp
from routes.bookings import bookings_bp
from routes.tickets import tickets_bp
from routes.recommendations import recommendations_bp
from routes.profile import profile_bp

load_dotenv()

app = Flask(__name__)
CORS(app)


# ==============================
# REGISTER ROUTE GROUPS
# ==============================

app.register_blueprint(
    auth_bp,
    url_prefix="/api/auth"
)

app.register_blueprint(
    preferences_bp,
    url_prefix="/api/preferences"
)
app.register_blueprint(
    profile_bp,
    url_prefix="/api/profile"
)
app.register_blueprint(
    events_bp,
    url_prefix="/api/events"
)

app.register_blueprint(
    bookmarks_bp,
    url_prefix="/api/bookmarks"
)

app.register_blueprint(
    interactions_bp,
    url_prefix="/api/interactions"
)

app.register_blueprint(
    bookings_bp,
    url_prefix="/api/bookings"
)

app.register_blueprint(
    tickets_bp,
    url_prefix="/api/tickets"
)

app.register_blueprint(
    recommendations_bp,
    url_prefix="/api/recommendations"
)


# ==============================
# DATABASE CONNECTION
# ==============================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# ==============================
# HOME
# ==============================

@app.route("/")
def home():
    return jsonify({
        "message": "Behavior-Aware Event Assistant API is running"
    })


# ==============================
# DATABASE TEST
# ==============================

@app.route("/db-test")
def db_test():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT version();")
        version = cur.fetchone()[0]

        cur.close()
        conn.close()

        return jsonify({
            "status": "success",
            "message": "Connected to PostgreSQL successfully",
            "database_version": version
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ==============================
# RUN APP
# ==============================

if __name__ == "__main__":
    app.run(debug=True)