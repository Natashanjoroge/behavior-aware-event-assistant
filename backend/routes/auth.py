from flask import Blueprint, request, jsonify
import psycopg
import os
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint("auth", __name__)

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")
    user_type = data.get("user_type")

    if not full_name or not email or not password or not user_type:
        return jsonify({"message": "All fields are required"}), 400

    if user_type not in ["student", "organizer"]:
        return jsonify({"message": "Invalid user type"}), 400

    password_hash = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO users (full_name, email, password_hash, user_type)
            VALUES (%s, %s, %s, %s)
            RETURNING user_id, full_name, email, user_type;
            """,
            (full_name, email, password_hash, user_type),
        )

        user = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Registration successful",
            "user": {
                "user_id": user[0],
                "full_name": user[1],
                "email": user[2],
                "user_type": user[3]
            }
        }), 201

    except psycopg.errors.UniqueViolation:
        return jsonify({"message": "Email already registered"}), 409

    except Exception as e:
        return jsonify({"message": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT user_id, full_name, email, password_hash, user_type
            FROM users
            WHERE email = %s AND is_active = TRUE;
            """,
            (email,),
        )

        user = cur.fetchone()

        if not user or not check_password_hash(user[3], password):
            cur.close()
            conn.close()
            return jsonify({"message": "Invalid email or password"}), 401

        cur.execute(
            """
            UPDATE users
            SET last_login = CURRENT_TIMESTAMP
            WHERE user_id = %s;
            """,
            (user[0],),
        )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Login successful",
            "user": {
                "user_id": user[0],
                "full_name": user[1],
                "email": user[2],
                "user_type": user[4]
            }
        })

    except Exception as e:
        return jsonify({"message": str(e)}), 500