from flask import Blueprint, request, jsonify
from datetime import datetime
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
    data = request.get_json() or {}

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
            SELECT
                booking_id,
                booking_status
            FROM bookings
            WHERE booking_id = %s;
        """, (
            booking_id,
        ))

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
                "message": (
                    "Cannot generate ticket "
                    "for cancelled booking"
                )
            }), 400

        # Check whether ticket already exists
        cur.execute("""
            SELECT
                ticket_id,
                ticket_code,
                ticket_status,
                issued_at,
                checked_in_at
            FROM tickets
            WHERE booking_id = %s;
        """, (
            booking_id,
        ))

        existing_ticket = cur.fetchone()

        if existing_ticket:
            cur.close()
            conn.close()

            return jsonify({
                "message": "Ticket already exists",
                "ticket_id": existing_ticket[0],
                "ticket_code": existing_ticket[1],
                "ticket_status": existing_ticket[2],
                "issued_at": (
                    existing_ticket[3].isoformat()
                    if existing_ticket[3]
                    else None
                ),
                "checked_in_at": (
                    existing_ticket[4].isoformat()
                    if existing_ticket[4]
                    else None
                ),
            }), 200

        # Generate unique ticket code
        ticket_code = (
            "EVT-" +
            uuid.uuid4().hex[:8].upper()
        )

        # Create ticket
        cur.execute("""
            INSERT INTO tickets (
                booking_id,
                ticket_code,
                ticket_status
            )
            VALUES (
                %s,
                %s,
                'active'
            )
            RETURNING
                ticket_id,
                ticket_code,
                ticket_status,
                issued_at,
                checked_in_at;
        """, (
            booking_id,
            ticket_code
        ))

        ticket = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": (
                "Ticket generated successfully"
            ),
            "ticket_id": ticket[0],
            "ticket_code": ticket[1],
            "ticket_status": ticket[2],
            "issued_at": (
                ticket[3].isoformat()
                if ticket[3]
                else None
            ),
            "checked_in_at": (
                ticket[4].isoformat()
                if ticket[4]
                else None
            )
        }), 201

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# GET TICKET BY BOOKING
# ==============================

@tickets_bp.route(
    "/booking/<int:booking_id>",
    methods=["GET"]
)
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
        """, (
            booking_id,
        ))

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
            "issued_at": (
                ticket[4].isoformat()
                if ticket[4]
                else None
            ),
            "checked_in_at": (
                ticket[5].isoformat()
                if ticket[5]
                else None
            )
        })

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# VERIFY TICKET CODE
# ==============================

@tickets_bp.route(
    "/verify/<string:ticket_code>",
    methods=["GET"]
)
def verify_ticket(ticket_code):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                t.ticket_id,
                t.ticket_code,
                t.ticket_status,
                t.issued_at,
                t.checked_in_at,

                b.booking_id,
                b.booking_status,

                u.user_id,
                u.full_name,
                u.email,

                e.event_id,
                e.event_name,
                e.location,
                e.event_date,
                e.end_date,
                e.status,
                e.organizer_id,

                ec.category_name

            FROM tickets t

            JOIN bookings b
                ON t.booking_id = b.booking_id

            JOIN users u
                ON b.user_id = u.user_id

            JOIN events e
                ON b.event_id = e.event_id

            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id

            WHERE UPPER(t.ticket_code) = UPPER(%s);
        """, (
            ticket_code.strip(),
        ))

        ticket = cur.fetchone()

        cur.close()
        conn.close()

        if not ticket:
            return jsonify({
                "valid": False,
                "message": "Ticket not found."
            }), 404

        ticket_status = ticket[2]
        booking_status = ticket[6]
        event_status = ticket[15]

        valid_for_checkin = (
            ticket_status == "active"
            and booking_status != "cancelled"
            and event_status != "cancelled"
        )

        return jsonify({
            "valid": valid_for_checkin,

            "ticket": {
                "ticket_id": ticket[0],
                "ticket_code": ticket[1],
                "ticket_status": ticket[2],

                "issued_at": (
                    ticket[3].isoformat()
                    if ticket[3]
                    else None
                ),

                "checked_in_at": (
                    ticket[4].isoformat()
                    if ticket[4]
                    else None
                ),
            },

            "booking": {
                "booking_id": ticket[5],
                "booking_status": ticket[6],
            },

            "student": {
                "user_id": ticket[7],
                "full_name": ticket[8],
                "email": ticket[9],
            },

            "event": {
                "event_id": ticket[10],
                "event_name": ticket[11],
                "location": ticket[12],

                "event_date": (
                    ticket[13].isoformat()
                    if ticket[13]
                    else None
                ),

                "end_date": (
                    ticket[14].isoformat()
                    if ticket[14]
                    else None
                ),

                "status": ticket[15],
                "organizer_id": ticket[16],
                "category_name": ticket[17],
            },

            "message": (
                "Ticket is valid."
                if valid_for_checkin
                else get_invalid_ticket_message(
                    ticket_status,
                    booking_status,
                    event_status
                )
            )
        }), 200

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# ORGANIZER CHECK-IN
# ==============================

@tickets_bp.route(
    "/check-in",
    methods=["POST"]
)
def check_in_ticket():
    data = request.get_json() or {}

    ticket_code = data.get(
        "ticket_code"
    )

    organizer_id = data.get(
        "organizer_id"
    )

    if not ticket_code:
        return jsonify({
            "message": (
                "ticket_code is required"
            )
        }), 400

    if not organizer_id:
        return jsonify({
            "message": (
                "organizer_id is required"
            )
        }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ==============================
        # GET TICKET + BOOKING + EVENT
        # ==============================

        cur.execute("""
            SELECT
                t.ticket_id,
                t.ticket_code,
                t.ticket_status,
                t.checked_in_at,

                b.booking_id,
                b.booking_status,

                u.user_id,
                u.full_name,
                u.email,

                e.event_id,
                e.event_name,
                e.location,
                e.event_date,
                e.end_date,
                e.status,
                e.organizer_id

            FROM tickets t

            JOIN bookings b
                ON t.booking_id = b.booking_id

            JOIN users u
                ON b.user_id = u.user_id

            JOIN events e
                ON b.event_id = e.event_id

            WHERE UPPER(t.ticket_code) = UPPER(%s)

            FOR UPDATE;
        """, (
            ticket_code.strip(),
        ))

        record = cur.fetchone()

        if not record:
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "Ticket not found."
                )
            }), 404

        ticket_id = record[0]
        stored_ticket_code = record[1]
        ticket_status = record[2]
        checked_in_at = record[3]

        booking_id = record[4]
        booking_status = record[5]

        student_id = record[6]
        student_name = record[7]
        student_email = record[8]

        event_id = record[9]
        event_name = record[10]
        event_location = record[11]
        event_date = record[12]
        event_end_date = record[13]
        event_status = record[14]
        event_organizer_id = record[15]

        # ==============================
        # ORGANIZER OWNERSHIP
        # ==============================

        if (
            int(event_organizer_id) !=
            int(organizer_id)
        ):
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "You cannot check in tickets "
                    "for another organizer's event."
                )
            }), 403

        # ==============================
        # EVENT STATUS
        # ==============================

        if event_status == "cancelled":
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "This event has been cancelled."
                )
            }), 400

        # ==============================
        # BOOKING STATUS
        # ==============================

        if booking_status == "cancelled":
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "This booking has been cancelled."
                )
            }), 400

        # ==============================
        # ALREADY USED
        # ==============================

        if ticket_status == "used":
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "This ticket has already "
                    "been checked in."
                ),

                "ticket_code":
                    stored_ticket_code,

                "checked_in_at": (
                    checked_in_at.isoformat()
                    if checked_in_at
                    else None
                ),

                "student": {
                    "user_id": student_id,
                    "full_name": student_name,
                    "email": student_email,
                },

                "event": {
                    "event_id": event_id,
                    "event_name": event_name,
                    "location": event_location,
                }
            }), 409

        # ==============================
        # INVALID TICKET STATUS
        # ==============================

        if ticket_status != "active":
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "This ticket is not active."
                )
            }), 400

        # ==============================
        # CHECK IN
        # ==============================

        checked_in_time = datetime.now()

        cur.execute("""
            UPDATE tickets
            SET
                ticket_status = 'used',
                checked_in_at = %s
            WHERE ticket_id = %s;
        """, (
            checked_in_time,
            ticket_id
        ))

        # ==============================
        # MARK BOOKING ATTENDED
        # ==============================

        cur.execute("""
            UPDATE bookings
            SET booking_status = 'attended'
            WHERE booking_id = %s;
        """, (
            booking_id,
        ))

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": (
                "Check-in successful."
            ),

            "ticket": {
                "ticket_id": ticket_id,
                "ticket_code":
                    stored_ticket_code,
                "ticket_status": "used",
                "checked_in_at":
                    checked_in_time.isoformat(),
            },

            "booking": {
                "booking_id": booking_id,
                "booking_status":
                    "attended",
            },

            "student": {
                "user_id": student_id,
                "full_name": student_name,
                "email": student_email,
            },

            "event": {
                "event_id": event_id,
                "event_name": event_name,
                "location": event_location,

                "event_date": (
                    event_date.isoformat()
                    if event_date
                    else None
                ),

                "end_date": (
                    event_end_date.isoformat()
                    if event_end_date
                    else None
                ),
            }
        }), 200

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# GET EVENT CHECK-IN LIST
# ==============================

@tickets_bp.route(
    "/event/<int:event_id>/check-ins",
    methods=["GET"]
)
def get_event_checkins(event_id):
    organizer_id = request.args.get(
        "organizer_id"
    )

    if not organizer_id:
        return jsonify({
            "message": (
                "organizer_id is required"
            )
        }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Confirm event ownership
        cur.execute("""
            SELECT
                event_id,
                event_name,
                organizer_id
            FROM events
            WHERE event_id = %s;
        """, (
            event_id,
        ))

        event = cur.fetchone()

        if not event:
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "Event not found."
                )
            }), 404

        if (
            int(event[2]) !=
            int(organizer_id)
        ):
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "You cannot view check-ins "
                    "for another organizer's event."
                )
            }), 403

        cur.execute("""
            SELECT
                t.ticket_id,
                t.ticket_code,
                t.ticket_status,
                t.checked_in_at,

                b.booking_id,
                b.booking_status,

                u.user_id,
                u.full_name,
                u.email

            FROM bookings b

            JOIN users u
                ON b.user_id = u.user_id

            LEFT JOIN tickets t
                ON b.booking_id = t.booking_id

            WHERE b.event_id = %s
              AND b.booking_status != 'cancelled'

            ORDER BY
                t.checked_in_at DESC NULLS LAST,
                u.full_name ASC;
        """, (
            event_id,
        ))

        rows = cur.fetchall()

        attendees = []

        for row in rows:
            attendees.append({
                "ticket_id": row[0],
                "ticket_code": row[1],
                "ticket_status": row[2],

                "checked_in_at": (
                    row[3].isoformat()
                    if row[3]
                    else None
                ),

                "booking_id": row[4],
                "booking_status": row[5],

                "student": {
                    "user_id": row[6],
                    "full_name": row[7],
                    "email": row[8],
                }
            })

        total_booked = len(
            attendees
        )

        total_checked_in = len([
            attendee
            for attendee in attendees
            if (
                attendee["ticket_status"]
                == "used"
                or
                attendee["booking_status"]
                == "attended"
            )
        ])

        cur.close()
        conn.close()

        return jsonify({
            "event": {
                "event_id": event[0],
                "event_name": event[1],
            },

            "summary": {
                "total_booked":
                    total_booked,

                "total_checked_in":
                    total_checked_in,

                "remaining":
                    max(
                        total_booked -
                        total_checked_in,
                        0
                    )
            },

            "attendees":
                attendees
        }), 200

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# HELPER
# ==============================

def get_invalid_ticket_message(
    ticket_status,
    booking_status,
    event_status
):
    if event_status == "cancelled":
        return (
            "The event has been cancelled."
        )

    if booking_status == "cancelled":
        return (
            "The booking has been cancelled."
        )

    if ticket_status == "used":
        return (
            "The ticket has already "
            "been checked in."
        )

    if ticket_status != "active":
        return (
            "The ticket is not active."
        )

    return "Ticket cannot be checked in."