from flask import Blueprint, request, jsonify
import psycopg
import os

bookmarks_bp = Blueprint("bookmarks", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


@bookmarks_bp.route("/", methods=["POST"])
def add_bookmark():
    data = request.get_json()

    user_id = data.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return jsonify({
            "message": "user_id and event_id are required"
        }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO bookmarks (user_id, event_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, event_id)
            DO NOTHING
            RETURNING bookmark_id;
        """, (user_id, event_id))

        bookmark = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        if bookmark:
            return jsonify({
                "message": "Event saved successfully"
            }), 201

        return jsonify({
            "message": "Event already saved"
        }), 200

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@bookmarks_bp.route("/<int:user_id>", methods=["GET"])
def get_bookmarks(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                b.bookmark_id,
                e.event_id,
                e.event_name,
                e.description,
                e.location,
                e.event_date,
                ec.category_name
            FROM bookmarks b
            JOIN events e
                ON b.event_id = e.event_id
            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id
            WHERE b.user_id = %s
            ORDER BY b.created_at DESC;
        """, (user_id,))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify([
            {
                "bookmark_id": row[0],
                "event_id": row[1],
                "event_name": row[2],
                "description": row[3],
                "location": row[4],
                "event_date": row[5].isoformat() if row[5] else None,
                "category_name": row[6]
            }
            for row in rows
        ])

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@bookmarks_bp.route("/", methods=["DELETE"])
def remove_bookmark():
    data = request.get_json()

    user_id = data.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return jsonify({
            "message": "user_id and event_id are required"
        }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            DELETE FROM bookmarks
            WHERE user_id = %s
            AND event_id = %s;
        """, (user_id, event_id))

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Bookmark removed"
        })

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500