from flask import Blueprint, request, jsonify
import psycopg
import os

interactions_bp = Blueprint("interactions", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


INTERACTION_WEIGHTS = {
    "VIEW": 1.0,
    "SEARCH": 0.5,
    "DETAIL_VIEW": 2.0,
    "BOOKMARK": 3.0,
    "BOOKING_ATTEMPT": 4.0,
    "BOOKING_COMPLETE": 5.0,
}


@interactions_bp.route("/log", methods=["POST"])
def log_interaction():
    data = request.get_json()

    user_id = data.get("user_id")
    event_id = data.get("event_id")
    interaction_type = data.get("interaction_type")
    session_id = data.get("session_id")

    if not user_id:
        return jsonify({
            "message": "user_id is required"
        }), 400

    if interaction_type not in INTERACTION_WEIGHTS:
        return jsonify({
            "message": "Invalid interaction type"
        }), 400

    confidence_weight = INTERACTION_WEIGHTS[interaction_type]

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO interactions (
                user_id,
                event_id,
                interaction_type,
                confidence_weight,
                session_id
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING interaction_id;
        """, (
            user_id,
            event_id,
            interaction_type,
            confidence_weight,
            session_id
        ))

        interaction_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Interaction logged successfully",
            "interaction_id": interaction_id,
            "interaction_type": interaction_type,
            "confidence_weight": confidence_weight
        }), 201

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@interactions_bp.route("/user/<int:user_id>", methods=["GET"])
def get_user_interactions(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                interaction_id,
                event_id,
                interaction_type,
                confidence_weight,
                timestamp,
                session_id
            FROM interactions
            WHERE user_id = %s
            ORDER BY timestamp DESC;
        """, (user_id,))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify([
            {
                "interaction_id": row[0],
                "event_id": row[1],
                "interaction_type": row[2],
                "confidence_weight": float(row[3]),
                "timestamp": row[4].isoformat() if row[4] else None,
                "session_id": row[5]
            }
            for row in rows
        ])

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500