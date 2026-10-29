from flask import Blueprint, request, jsonify
import psycopg
import os
import uuid

tickets_bp = Blueprint("tickets", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# ==============================
# GENERATE TICKET
# ==============================

@tickets_bp.route("/generate", methods=["POST"])
def generate_ticket():
    data = request.get_json()

    booking_id = data.get("booking_id")

    if not booking_id:
        return jsonify({
            "message": "booking_id is required"
        }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check whether booking exists
        cur.execute("""
            SELECT booking_id, booking_status
            FROM bookings
            WHERE booking_id = %s;
        """, (booking_id,))

        booking = cur.fetchone()

        if not booking:
            cur.close()
            conn.close()

            return jsonify({
                "message": "Booking not found"
            }), 404

        # Do not create ticket for cancelled booking
        if booking[1] == "cancelled":
            cur.close()
            conn.close()

            return jsonify({
                "message": "Cannot generate ticket for cancelled booking"
            }), 400

        # Check whether ticket already exists
        cur.execute("""
            SELECT
                ticket_id,
                ticket_code,
                ticket_status
            FROM tickets
            WHERE booking_id = %s;
        """, (booking_id,))

        existing_ticket = cur.fetchone()

        if existing_ticket:
            cur.close()
            conn.close()

            return jsonify({
                "message": "Ticket already exists",
                "ticket_id": existing_ticket[0],
                "ticket_code": existing_ticket[1],
                "ticket_status": existing_ticket[2]
            }), 200

        # Generate unique ticket code
        ticket_code = "EVT-" + uuid.uuid4().hex[:8].upper()

        # Create ticket
        cur.execute("""
            INSERT INTO tickets (
                booking_id,
                ticket_code,
                ticket_status
            )
            VALUES (%s, %s, 'active')
            RETURNING
                ticket_id,
                ticket_code,
                ticket_status,
                issued_at;
        """, (booking_id, ticket_code))

        ticket = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Ticket generated successfully",
            "ticket_id": ticket[0],
            "ticket_code": ticket[1],
            "ticket_status": ticket[2],
            "issued_at": ticket[3].isoformat() if ticket[3] else None
        }), 201

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# GET TICKET BY BOOKING
# ==============================

@tickets_bp.route("/booking/<int:booking_id>", methods=["GET"])
def get_ticket_by_booking(booking_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                ticket_id,
                booking_id,
                ticket_code,
                ticket_status,
                issued_at,
                checked_in_at
            FROM tickets
            WHERE booking_id = %s;
        """, (booking_id,))

        ticket = cur.fetchone()

        cur.close()
        conn.close()

        if not ticket:
            return jsonify({
                "message": "Ticket not found"
            }), 404

        return jsonify({
            "ticket_id": ticket[0],
            "booking_id": ticket[1],
            "ticket_code": ticket[2],
            "ticket_status": ticket[3],
            "issued_at": ticket[4].isoformat() if ticket[4] else None,
            "checked_in_at": ticket[5].isoformat() if ticket[5] else None
        })

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500