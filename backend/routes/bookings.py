from flask import Blueprint, request, jsonify
import psycopg
import os

bookings_bp = Blueprint("bookings", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


@bookings_bp.route("/", methods=["POST"])
def create_booking():
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

        # Check whether booking already exists
        cur.execute("""
            SELECT booking_id, booking_status
            FROM bookings
            WHERE user_id = %s
              AND event_id = %s;
        """, (user_id, event_id))

        existing = cur.fetchone()

        if existing:
            cur.close()
            conn.close()

            return jsonify({
                "message": "You already have a booking for this event",
                "booking_id": existing[0],
                "booking_status": existing[1]
            }), 200

        cur.execute("""
            INSERT INTO bookings (
                user_id,
                event_id,
                booking_status
            )
            VALUES (%s, %s, 'confirmed')
            RETURNING booking_id;
        """, (user_id, event_id))

        booking_id = cur.fetchone()[0]

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Event booked successfully",
            "booking_id": booking_id,
            "booking_status": "confirmed"
        }), 201

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@bookings_bp.route("/user/<int:user_id>", methods=["GET"])
def get_user_bookings(user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                b.booking_id,
                b.booking_status,
                b.booked_at,
                e.event_id,
                e.event_name,
                e.description,
                e.location,
                e.event_date,
                e.end_date,
                ec.category_name
            FROM bookings b
            JOIN events e
                ON b.event_id = e.event_id
            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id
            WHERE b.user_id = %s
              AND b.booking_status != 'cancelled'
            ORDER BY e.event_date ASC;
        """, (user_id,))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        bookings = []

        for row in rows:
            bookings.append({
                "booking_id": row[0],
                "booking_status": row[1],
                "booked_at": row[2].isoformat() if row[2] else None,
                "event_id": row[3],
                "event_name": row[4],
                "description": row[5],
                "location": row[6],
                "event_date": row[7].isoformat() if row[7] else None,
                "end_date": row[8].isoformat() if row[8] else None,
                "category_name": row[9]
            })

        return jsonify(bookings)

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


@bookings_bp.route("/cancel", methods=["PUT"])
def cancel_booking():
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
            UPDATE bookings
            SET
                booking_status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
              AND event_id = %s
            RETURNING booking_id;
        """, (user_id, event_id))

        booking = cur.fetchone()

        if not booking:
            cur.close()
            conn.close()

            return jsonify({
                "message": "Booking not found"
            }), 404

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Booking cancelled successfully"
        })

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500