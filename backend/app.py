import os
import psycopg
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth import auth_bp
load_dotenv()

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth_bp, url_prefix="/api/auth")

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


@app.route("/")
def home():
    return jsonify({
        "message": "Behavior-Aware Event Assistant API is running"
    })


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


if __name__ == "__main__":
    app.run(debug=True)