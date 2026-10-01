from flask import Blueprint, jsonify
import psycopg
import os

events_bp = Blueprint("events", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


@events_bp.route("/", methods=["GET"])
def get_events():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                e.event_id,
                e.event_name,
                e.description,
                e.location,
                e.event_date,
                e.end_date,
                e.capacity,
                e.status,
                ec.category_name
            FROM events e
            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id
            WHERE e.status != 'cancelled'
            ORDER BY e.event_date ASC;
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        events = []

        for row in rows:
            events.append({
                "event_id": row[0],
                "event_name": row[1],
                "description": row[2],
                "location": row[3],
                "event_date": row[4].isoformat() if row[4] else None,
                "end_date": row[5].isoformat() if row[5] else None,
                "capacity": row[6],
                "status": row[7],
                "category_name": row[8]
            })

        return jsonify(events)

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500