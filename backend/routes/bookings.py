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


# ==============================
# CREATE BOOKING
# ==============================

@bookings_bp.route("/", methods=["POST"])
def create_booking():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return jsonify({
            "message": "user_id and event_id are required"
        }), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ==============================
        # CHECK USER
        # ==============================

        cur.execute("""
            SELECT
                user_id,
                user_type
            FROM users
            WHERE user_id = %s;
        """, (
            user_id,
        ))

        user = cur.fetchone()

        if not user:
            return jsonify({
                "message": "User not found."
            }), 404

        # ==============================
        # CHECK EVENT
        # ==============================

        cur.execute("""
            SELECT
                event_id,
                event_name,
                status,
                capacity,
                is_paid,
                ticket_price
            FROM events
            WHERE event_id = %s;
        """, (
            event_id,
        ))

        event = cur.fetchone()

        if not event:
            return jsonify({
                "message": "Event not found."
            }), 404

        event_name = event[1]
        event_status = event[2]
        capacity = event[3]
        is_paid = bool(event[4])

        ticket_price = (
            float(event[5])
            if event[5] is not None
            else 0.0
        )

        # ==============================
        # EVENT STATUS
        # ==============================

        if event_status == "cancelled":
            return jsonify({
                "message": (
                    "This event has been cancelled "
                    "and cannot be booked."
                )
            }), 400

        # ==============================
        # EXISTING BOOKING
        # ==============================

        cur.execute("""
            SELECT
                booking_id,
                booking_status
            FROM bookings
            WHERE user_id = %s
              AND event_id = %s;
        """, (
            user_id,
            event_id,
        ))

        existing = cur.fetchone()

        if existing:
            booking_id = existing[0]
            booking_status = existing[1]

            if booking_status in (
                "confirmed",
                "attended",
            ):
                return jsonify({
                    "message": (
                        "You already have a booking "
                        "for this event."
                    ),
                    "booking_id": booking_id,
                    "booking_status": booking_status,
                    "is_paid": is_paid,
                    "ticket_price": ticket_price,
                }), 200

        # ==============================
        # PAID EVENT
        # ==============================

        if is_paid:
            return jsonify({
                "message": (
                    "This is a paid event. "
                    "Complete the M-Pesa payment "
                    "to confirm your booking."
                ),
                "payment_required": True,
                "event_id": event_id,
                "event_name": event_name,
                "ticket_price": ticket_price,
                "booking_id": (
                    existing[0]
                    if existing
                    else None
                ),
                "booking_status": (
                    existing[1]
                    if existing
                    else None
                ),
            }), 402

        # ==============================
        # CHECK CAPACITY
        # ==============================

        if capacity:
            cur.execute("""
                SELECT COUNT(*)
                FROM bookings
                WHERE event_id = %s
                  AND booking_status IN (
                      'confirmed',
                      'attended'
                  );
            """, (
                event_id,
            ))

            confirmed_count = (
                cur.fetchone()[0]
            )

            if confirmed_count >= capacity:
                return jsonify({
                    "message": (
                        "This event is fully booked."
                    )
                }), 400

        # ==============================
        # REACTIVATE EXISTING BOOKING
        # ==============================

        if existing:
            booking_id = existing[0]

            cur.execute("""
                UPDATE bookings
                SET
                    booking_status = 'confirmed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE booking_id = %s
                RETURNING booking_id;
            """, (
                booking_id,
            ))

            booking_id = cur.fetchone()[0]

            conn.commit()

            return jsonify({
                "message": "Event booked successfully",
                "booking_id": booking_id,
                "booking_status": "confirmed",
                "is_paid": False,
                "ticket_price": 0.0,
            }), 200

        # ==============================
        # CREATE FREE BOOKING
        # ==============================

        cur.execute("""
            INSERT INTO bookings (
                user_id,
                event_id,
                booking_status
            )
            VALUES (
                %s,
                %s,
                'confirmed'
            )
            RETURNING booking_id;
        """, (
            user_id,
            event_id,
        ))

        booking_id = cur.fetchone()[0]

        conn.commit()

        return jsonify({
            "message": "Event booked successfully",
            "booking_id": booking_id,
            "booking_status": "confirmed",
            "is_paid": False,
            "ticket_price": 0.0,
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()

        return jsonify({
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# ==============================
# GET USER BOOKINGS
# ==============================

@bookings_bp.route(
    "/user/<int:user_id>",
    methods=["GET"]
)
def get_user_bookings(user_id):
    conn = None
    cur = None

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

                ec.category_name,

                e.is_paid,
                e.ticket_price,

                p.payment_id,
                p.payment_status,
                p.mpesa_receipt_number,

                t.ticket_id,
                t.ticket_code,
                t.ticket_status

            FROM bookings b

            JOIN events e
                ON b.event_id =
                   e.event_id

            LEFT JOIN event_categories ec
                ON e.category_id =
                   ec.category_id

            LEFT JOIN payments p
                ON p.booking_id =
                   b.booking_id
                AND p.payment_id = (
                    SELECT MAX(p2.payment_id)
                    FROM payments p2
                    WHERE p2.booking_id =
                          b.booking_id
                )

            LEFT JOIN tickets t
                ON t.booking_id =
                   b.booking_id

            WHERE b.user_id = %s
              AND b.booking_status != 'cancelled'

            ORDER BY
                e.event_date ASC;
        """, (
            user_id,
        ))

        rows = cur.fetchall()

        bookings = []

        for row in rows:
            bookings.append({
                "booking_id":
                    row[0],

                "booking_status":
                    row[1],

                "booked_at": (
                    row[2].isoformat()
                    if row[2]
                    else None
                ),

                "event_id":
                    row[3],

                "event_name":
                    row[4],

                "description":
                    row[5],

                "location":
                    row[6],

                "event_date": (
                    row[7].isoformat()
                    if row[7]
                    else None
                ),

                "end_date": (
                    row[8].isoformat()
                    if row[8]
                    else None
                ),

                "category_name":
                    row[9],

                "is_paid":
                    bool(row[10]),

                "ticket_price": (
                    float(row[11])
                    if row[11] is not None
                    else 0.0
                ),

                "payment_id":
                    row[12],

                "payment_status":
                    row[13],

                "mpesa_receipt_number":
                    row[14],

                "ticket_id":
                    row[15],

                "ticket_code":
                    row[16],

                "ticket_status":
                    row[17],
            })

        return jsonify(bookings), 200

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# ==============================
# CANCEL BOOKING
# ==============================

@bookings_bp.route(
    "/cancel",
    methods=["PUT"]
)
def cancel_booking():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    event_id = data.get("event_id")

    if not user_id or not event_id:
        return jsonify({
            "message": (
                "user_id and event_id are required"
            )
        }), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                booking_id,
                booking_status
            FROM bookings
            WHERE user_id = %s
              AND event_id = %s;
        """, (
            user_id,
            event_id,
        ))

        booking = cur.fetchone()

        if not booking:
            return jsonify({
                "message": "Booking not found"
            }), 404

        if booking[1] == "attended":
            return jsonify({
                "message": (
                    "An attended booking "
                    "cannot be cancelled."
                )
            }), 400

        if booking[1] == "cancelled":
            return jsonify({
                "message": (
                    "This booking is already cancelled."
                )
            }), 200

        booking_id = booking[0]

        cur.execute("""
            UPDATE bookings
            SET
                booking_status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE booking_id = %s;
        """, (
            booking_id,
        ))

        cur.execute("""
            UPDATE tickets
            SET ticket_status = 'cancelled'
            WHERE booking_id = %s
              AND ticket_status = 'active';
        """, (
            booking_id,
        ))

        conn.commit()

        return jsonify({
            "message":
                "Booking cancelled successfully",
            "booking_id":
                booking_id,
            "booking_status":
                "cancelled",
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()

        return jsonify({
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()