from flask import Blueprint, request, jsonify
import psycopg
import os

preferences_bp = Blueprint("preferences", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


@preferences_bp.route("/categories", methods=["GET"])
def get_categories():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT category_id, category_name, description
            FROM event_categories
            ORDER BY category_id;
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify([
            {
                "category_id": row[0],
                "category_name": row[1],
                "description": row[2]
            }
            for row in rows
        ])

    except Exception as e:
        return jsonify({"message": str(e)}), 500


@preferences_bp.route("/save", methods=["POST"])
def save_preferences():
    data = request.get_json()

    user_id = data.get("user_id")
    category_ids = data.get("category_ids", [])

    if not user_id or len(category_ids) == 0:
        return jsonify({
            "message": "Please select at least one interest"
        }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "DELETE FROM user_preferences WHERE user_id = %s",
            (user_id,)
        )

        for category_id in category_ids:
            cur.execute("""
                INSERT INTO user_preferences (user_id, category_id)
                VALUES (%s, %s)
            """, (user_id, category_id))

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Preferences saved successfully"
        })

    except Exception as e:
        return jsonify({"message": str(e)}), 500


@preferences_bp.route("/user/<int:user_id>", methods=["GET"])
def get_user_preferences(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                ec.category_id,
                ec.category_name
            FROM user_preferences up
            JOIN event_categories ec
                ON up.category_id = ec.category_id
            WHERE up.user_id = %s
        """, (user_id,))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify([
            {
                "category_id": row[0],
                "category_name": row[1]
            }
            for row in rows
        ])

    except Exception as e:
        return jsonify({"message": str(e)}), 500