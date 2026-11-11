from flask import Blueprint, jsonify, request
from datetime import datetime
from decimal import Decimal, InvalidOperation
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


# ==============================
# DATE HELPERS
# ==============================

def parse_event_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except (ValueError, TypeError):
        return None


def is_date_before_today(value):
    parsed_date = parse_event_datetime(value)

    if not parsed_date:
        return False

    return (
        parsed_date.date()
        < datetime.now().date()
    )


# ==============================
# PAYMENT HELPERS
# ==============================

def parse_is_paid(value):
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in (
            "true",
            "1",
            "yes",
            "paid",
        )

    if isinstance(value, int):
        return value == 1

    return False


def parse_ticket_price(
    value,
    is_paid
):
    if not is_paid:
        return Decimal("0.00"), None

    if value is None or value == "":
        return None, (
            "Ticket price is required "
            "for paid events."
        )

    try:
        ticket_price = Decimal(
            str(value)
        ).quantize(
            Decimal("0.01")
        )

    except (
        InvalidOperation,
        ValueError,
        TypeError
    ):
        return None, (
            "Ticket price must be "
            "a valid number."
        )

    if ticket_price <= 0:
        return None, (
            "Ticket price must be "
            "greater than 0."
        )

    return ticket_price, None


# ==============================
# GET ALL EVENTS
# ==============================

@events_bp.route(
    "/",
    methods=["GET"]
)
def get_events():
    conn = None
    cur = None

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
                ec.category_name,
                e.category_id,
                e.organizer_id,
                e.is_paid,
                e.ticket_price
            FROM events e

            LEFT JOIN event_categories ec
                ON e.category_id =
                   ec.category_id

            WHERE e.status != 'cancelled'

            ORDER BY
                e.event_date ASC;
        """)

        rows = cur.fetchall()

        events = []

        for row in rows:
            events.append({
                "event_id":
                    row[0],

                "event_name":
                    row[1],

                "description":
                    row[2],

                "location":
                    row[3],

                "event_date": (
                    row[4].isoformat()
                    if row[4]
                    else None
                ),

                "end_date": (
                    row[5].isoformat()
                    if row[5]
                    else None
                ),

                "capacity":
                    row[6],

                "status":
                    row[7],

                "category_name":
                    row[8],

                "category_id":
                    row[9],

                "organizer_id":
                    row[10],

                "is_paid":
                    bool(row[11]),

                "ticket_price": (
                    float(row[12])
                    if row[12] is not None
                    else 0.0
                ),
            })

        return jsonify(events), 200

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
# CREATE EVENT
# ==============================

@events_bp.route(
    "/",
    methods=["POST"]
)
def create_event():
    data = request.get_json() or {}

    event_name = data.get(
        "event_name"
    )

    description = data.get(
        "description"
    )

    category_id = data.get(
        "category_id"
    )

    location = data.get(
        "location"
    )

    event_date = data.get(
        "event_date"
    )

    end_date = data.get(
        "end_date"
    )

    capacity = data.get(
        "capacity"
    )

    organizer_id = data.get(
        "organizer_id"
    )

    is_paid = parse_is_paid(
        data.get(
            "is_paid",
            False
        )
    )

    ticket_price, price_error = (
        parse_ticket_price(
            data.get(
                "ticket_price"
            ),
            is_paid
        )
    )

    if not event_name:
        return jsonify({
            "message":
                "Event name is required."
        }), 400

    if not description:
        return jsonify({
            "message":
                "Description is required."
        }), 400

    if not category_id:
        return jsonify({
            "message":
                "Event category is required."
        }), 400

    if not location:
        return jsonify({
            "message":
                "Location is required."
        }), 400

    if not event_date:
        return jsonify({
            "message":
                "Event date is required."
        }), 400

    if not organizer_id:
        return jsonify({
            "message":
                "Organizer ID is required."
        }), 400

    if price_error:
        return jsonify({
            "message": price_error
        }), 400

    parsed_event_date = (
        parse_event_datetime(
            event_date
        )
    )

    if not parsed_event_date:
        return jsonify({
            "message":
                "The event start date is invalid."
        }), 400

    if is_date_before_today(
        event_date
    ):
        return jsonify({
            "message": (
                "The event date cannot be "
                "before today's date."
            )
        }), 400

    parsed_end_date = None

    if end_date:
        parsed_end_date = (
            parse_event_datetime(
                end_date
            )
        )

        if not parsed_end_date:
            return jsonify({
                "message": (
                    "The event end date "
                    "is invalid."
                )
            }), 400

        if is_date_before_today(
            end_date
        ):
            return jsonify({
                "message": (
                    "The event end date "
                    "cannot be before "
                    "today's date."
                )
            }), 400

        if (
            parsed_end_date
            <= parsed_event_date
        ):
            return jsonify({
                "message": (
                    "The event end time must "
                    "be after the start time."
                )
            }), 400

    if capacity is not None:
        try:
            capacity = int(
                capacity
            )

            if capacity < 1:
                return jsonify({
                    "message": (
                        "Capacity must be "
                        "at least 1."
                    )
                }), 400

        except (
            ValueError,
            TypeError
        ):
            return jsonify({
                "message": (
                    "Capacity must be "
                    "a valid number."
                )
            }), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ==============================
        # CONFIRM ORGANIZER
        # ==============================

        cur.execute("""
            SELECT
                user_id,
                user_type
            FROM users
            WHERE user_id = %s;
        """, (
            organizer_id,
        ))

        organizer = cur.fetchone()

        if not organizer:
            return jsonify({
                "message":
                    "Organizer account not found."
            }), 404

        if organizer[1] != "organizer":
            return jsonify({
                "message": (
                    "This account is not "
                    "registered as an organizer."
                )
            }), 400

        # ==============================
        # CONFIRM CATEGORY
        # ==============================

        cur.execute("""
            SELECT category_id
            FROM event_categories
            WHERE category_id = %s;
        """, (
            category_id,
        ))

        category = cur.fetchone()

        if not category:
            return jsonify({
                "message":
                    "Event category not found."
            }), 404

        # ==============================
        # CREATE EVENT
        # ==============================

        cur.execute("""
            INSERT INTO events (
                event_name,
                description,
                category_id,
                location,
                event_date,
                end_date,
                capacity,
                status,
                organizer_id,
                is_paid,
                ticket_price
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'upcoming',
                %s,
                %s,
                %s
            )
            RETURNING event_id;
        """, (
            event_name.strip(),
            description.strip(),
            category_id,
            location.strip(),
            parsed_event_date,
            parsed_end_date,
            capacity,
            organizer_id,
            is_paid,
            ticket_price,
        ))

        event_id = (
            cur.fetchone()[0]
        )

        conn.commit()

        return jsonify({
            "message":
                "Event created successfully",

            "event_id":
                event_id,

            "is_paid":
                is_paid,

            "ticket_price":
                float(ticket_price),
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
# GET ORGANIZER EVENTS
# ==============================

@events_bp.route(
    "/organizer/<int:organizer_id>",
    methods=["GET"]
)
def get_organizer_events(
    organizer_id
):
    conn = None
    cur = None

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
                ec.category_name,
                e.category_id,
                e.is_paid,
                e.ticket_price
            FROM events e

            LEFT JOIN event_categories ec
                ON e.category_id =
                   ec.category_id

            WHERE e.organizer_id = %s

            ORDER BY
                e.event_date DESC;
        """, (
            organizer_id,
        ))

        rows = cur.fetchall()

        events = []

        for row in rows:
            events.append({
                "event_id":
                    row[0],

                "event_name":
                    row[1],

                "description":
                    row[2],

                "location":
                    row[3],

                "event_date": (
                    row[4].isoformat()
                    if row[4]
                    else None
                ),

                "end_date": (
                    row[5].isoformat()
                    if row[5]
                    else None
                ),

                "capacity":
                    row[6],

                "status":
                    row[7],

                "category_name":
                    row[8],

                "category_id":
                    row[9],

                "is_paid":
                    bool(row[10]),

                "ticket_price": (
                    float(row[11])
                    if row[11] is not None
                    else 0.0
                ),
            })

        return jsonify(events), 200

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
# ORGANIZER ANALYTICS
# ==============================

@events_bp.route(
    "/analytics/organizer/<int:organizer_id>",
    methods=["GET"]
)
def get_organizer_analytics(
    organizer_id
):
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ==============================
        # CONFIRM ORGANIZER
        # ==============================

        cur.execute("""
            SELECT
                user_id,
                full_name,
                user_type
            FROM users
            WHERE user_id = %s;
        """, (
            organizer_id,
        ))

        organizer = cur.fetchone()

        if not organizer:
            return jsonify({
                "message":
                    "Organizer not found."
            }), 404

        if organizer[2] != "organizer":
            return jsonify({
                "message": (
                    "This account is not "
                    "an organizer."
                )
            }), 400

        # ==============================
        # EVENT LEVEL ANALYTICS
        # ==============================

        cur.execute("""
            SELECT
                e.event_id,
                e.event_name,
                e.event_date,
                e.status,
                e.capacity,
                ec.category_name,
                e.is_paid,
                e.ticket_price,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM interactions i
                        WHERE
                            i.event_id =
                            e.event_id
                        AND
                            i.interaction_type
                            IN (
                                'VIEW',
                                'DETAIL_VIEW'
                            )
                    ),
                    0
                ) AS views,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM bookmarks bm
                        WHERE
                            bm.event_id =
                            e.event_id
                    ),
                    0
                ) AS bookmarks,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM bookings b
                        WHERE
                            b.event_id =
                            e.event_id
                        AND
                            b.booking_status
                            != 'cancelled'
                    ),
                    0
                ) AS bookings,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM bookings b2
                        WHERE
                            b2.event_id =
                            e.event_id
                        AND
                            b2.booking_status =
                            'attended'
                    ),
                    0
                ) AS attended

            FROM events e

            LEFT JOIN event_categories ec
                ON e.category_id =
                   ec.category_id

            WHERE e.organizer_id = %s

            ORDER BY
                e.event_date DESC;
        """, (
            organizer_id,
        ))

        rows = cur.fetchall()

        event_analytics = []

        total_views = 0
        total_bookmarks = 0
        total_bookings = 0
        total_attended = 0

        for row in rows:
            views = (
                row[8] or 0
            )

            bookmarks = (
                row[9] or 0
            )

            bookings = (
                row[10] or 0
            )

            attended = (
                row[11] or 0
            )

            conversion_rate = (
                round(
                    (
                        bookings /
                        views
                    ) * 100,
                    1
                )
                if views > 0
                else 0
            )

            bookmark_rate = (
                round(
                    (
                        bookmarks /
                        views
                    ) * 100,
                    1
                )
                if views > 0
                else 0
            )

            attendance_rate = (
                round(
                    (
                        attended /
                        bookings
                    ) * 100,
                    1
                )
                if bookings > 0
                else 0
            )

            capacity_utilization = (
                round(
                    (
                        bookings /
                        row[4]
                    ) * 100,
                    1
                )
                if (
                    row[4]
                    and row[4] > 0
                )
                else None
            )

            total_views += views
            total_bookmarks += bookmarks
            total_bookings += bookings
            total_attended += attended

            event_analytics.append({
                "event_id":
                    row[0],

                "event_name":
                    row[1],

                "event_date": (
                    row[2].isoformat()
                    if row[2]
                    else None
                ),

                "status":
                    row[3],

                "capacity":
                    row[4],

                "category_name":
                    row[5],

                "is_paid":
                    bool(row[6]),

                "ticket_price": (
                    float(row[7])
                    if row[7] is not None
                    else 0.0
                ),

                "views":
                    views,

                "bookmarks":
                    bookmarks,

                "bookings":
                    bookings,

                "attended":
                    attended,

                "conversion_rate":
                    conversion_rate,

                "bookmark_rate":
                    bookmark_rate,

                "attendance_rate":
                    attendance_rate,

                "capacity_utilization":
                    capacity_utilization,
            })

        # ==============================
        # OVERALL RATES
        # ==============================

        overall_conversion = (
            round(
                (
                    total_bookings /
                    total_views
                ) * 100,
                1
            )
            if total_views > 0
            else 0
        )

        overall_bookmark_rate = (
            round(
                (
                    total_bookmarks /
                    total_views
                ) * 100,
                1
            )
            if total_views > 0
            else 0
        )

        overall_attendance_rate = (
            round(
                (
                    total_attended /
                    total_bookings
                ) * 100,
                1
            )
            if total_bookings > 0
            else 0
        )

        # ==============================
        # CATEGORY PERFORMANCE
        # ==============================

        cur.execute("""
            SELECT
                ec.category_name,

                COUNT(
                    DISTINCT e.event_id
                ) AS event_count,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM interactions i

                        JOIN events ei
                            ON i.event_id =
                               ei.event_id

                        WHERE
                            ei.organizer_id = %s

                        AND
                            ei.category_id =
                            ec.category_id

                        AND
                            i.interaction_type
                            IN (
                                'VIEW',
                                'DETAIL_VIEW'
                            )
                    ),
                    0
                ) AS views,

                COALESCE(
                    (
                        SELECT COUNT(*)
                        FROM bookings b

                        JOIN events eb
                            ON b.event_id =
                               eb.event_id

                        WHERE
                            eb.organizer_id = %s

                        AND
                            eb.category_id =
                            ec.category_id

                        AND
                            b.booking_status
                            != 'cancelled'
                    ),
                    0
                ) AS bookings

            FROM event_categories ec

            JOIN events e
                ON e.category_id =
                   ec.category_id

            WHERE e.organizer_id = %s

            GROUP BY
                ec.category_id,
                ec.category_name

            ORDER BY
                bookings DESC,
                views DESC;
        """, (
            organizer_id,
            organizer_id,
            organizer_id,
        ))

        category_rows = (
            cur.fetchall()
        )

        category_performance = []

        for row in category_rows:
            category_performance.append({
                "category_name":
                    row[0],

                "event_count":
                    row[1],

                "views":
                    row[2],

                "bookings":
                    row[3],
            })

        # ==============================
        # TOP EVENT
        # ==============================

        top_event = None

        if event_analytics:
            top_event = max(
                event_analytics,
                key=lambda event: (
                    event["bookings"],
                    event["views"],
                    event["bookmarks"],
                )
            )

        return jsonify({
            "organizer": {
                "user_id":
                    organizer[0],

                "full_name":
                    organizer[1],
            },

            "summary": {
                "total_events":
                    len(
                        event_analytics
                    ),

                "total_views":
                    total_views,

                "total_bookmarks":
                    total_bookmarks,

                "total_bookings":
                    total_bookings,

                "total_attended":
                    total_attended,

                "conversion_rate":
                    overall_conversion,

                "bookmark_rate":
                    overall_bookmark_rate,

                "attendance_rate":
                    overall_attendance_rate,
            },

            "top_event":
                top_event,

            "category_performance":
                category_performance,

            "events":
                event_analytics,
        }), 200

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
# UPDATE EVENT
# ==============================

@events_bp.route(
    "/<int:event_id>",
    methods=["PUT"]
)
def update_event(
    event_id
):
    data = request.get_json() or {}

    organizer_id = data.get(
        "organizer_id"
    )

    event_name = data.get(
        "event_name"
    )

    description = data.get(
        "description"
    )

    location = data.get(
        "location"
    )

    event_date = data.get(
        "event_date"
    )

    end_date = data.get(
        "end_date"
    )

    capacity = data.get(
        "capacity"
    )

    category_id = data.get(
        "category_id"
    )

    if not organizer_id:
        return jsonify({
            "message":
                "Organizer ID is required."
        }), 400

    if not event_name:
        return jsonify({
            "message":
                "Event name is required."
        }), 400

    if not description:
        return jsonify({
            "message":
                "Description is required."
        }), 400

    if not location:
        return jsonify({
            "message":
                "Location is required."
        }), 400

    if not event_date:
        return jsonify({
            "message":
                "Event date is required."
        }), 400

    parsed_event_date = (
        parse_event_datetime(
            event_date
        )
    )

    if not parsed_event_date:
        return jsonify({
            "message": (
                "The event start date "
                "is invalid."
            )
        }), 400

    if is_date_before_today(
        event_date
    ):
        return jsonify({
            "message": (
                "The event date cannot "
                "be before today's date."
            )
        }), 400

    parsed_end_date = None

    if end_date:
        parsed_end_date = (
            parse_event_datetime(
                end_date
            )
        )

        if not parsed_end_date:
            return jsonify({
                "message": (
                    "The event end date "
                    "is invalid."
                )
            }), 400

        if is_date_before_today(
            end_date
        ):
            return jsonify({
                "message": (
                    "The event end date "
                    "cannot be before "
                    "today's date."
                )
            }), 400

        if (
            parsed_end_date
            <= parsed_event_date
        ):
            return jsonify({
                "message": (
                    "The event end time must "
                    "be after the start time."
                )
            }), 400

    if capacity is not None:
        try:
            capacity = int(
                capacity
            )

            if capacity < 1:
                return jsonify({
                    "message": (
                        "Capacity must be "
                        "at least 1."
                    )
                }), 400

        except (
            ValueError,
            TypeError
        ):
            return jsonify({
                "message": (
                    "Capacity must be "
                    "a valid number."
                )
            }), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ==============================
        # EXISTING EVENT
        # ==============================

        cur.execute("""
            SELECT
                event_id,
                organizer_id,
                status,
                category_id,
                is_paid,
                ticket_price
            FROM events
            WHERE event_id = %s;
        """, (
            event_id,
        ))

        existing_event = (
            cur.fetchone()
        )

        if not existing_event:
            return jsonify({
                "message":
                    "Event not found."
            }), 404

        if (
            existing_event[1]
            != int(organizer_id)
        ):
            return jsonify({
                "message": (
                    "You are not allowed "
                    "to edit this event."
                )
            }), 403

        if (
            existing_event[2]
            == "cancelled"
        ):
            return jsonify({
                "message": (
                    "Cancelled events "
                    "cannot be edited."
                )
            }), 400

        # ==============================
        # CATEGORY
        # ==============================

        final_category_id = (
            category_id
            if category_id is not None
            else existing_event[3]
        )

        if final_category_id:
            cur.execute("""
                SELECT category_id
                FROM event_categories
                WHERE category_id = %s;
            """, (
                final_category_id,
            ))

            category = (
                cur.fetchone()
            )

            if not category:
                return jsonify({
                    "message": (
                        "Event category "
                        "not found."
                    )
                }), 404

        # ==============================
        # PAID / FREE SETTINGS
        # ==============================

        if "is_paid" in data:
            final_is_paid = (
                parse_is_paid(
                    data.get(
                        "is_paid"
                    )
                )
            )
        else:
            final_is_paid = bool(
                existing_event[4]
            )

        if "ticket_price" in data:
            requested_price = (
                data.get(
                    "ticket_price"
                )
            )
        else:
            requested_price = (
                existing_event[5]
            )

        (
            final_ticket_price,
            price_error
        ) = parse_ticket_price(
            requested_price,
            final_is_paid
        )

        if price_error:
            return jsonify({
                "message":
                    price_error
            }), 400

        # ==============================
        # UPDATE EVENT
        # ==============================

        cur.execute("""
            UPDATE events
            SET
                event_name = %s,
                description = %s,
                category_id = %s,
                location = %s,
                event_date = %s,
                end_date = %s,
                capacity = %s,
                is_paid = %s,
                ticket_price = %s
            WHERE event_id = %s
            RETURNING event_id;
        """, (
            event_name.strip(),
            description.strip(),
            final_category_id,
            location.strip(),
            parsed_event_date,
            parsed_end_date,
            capacity,
            final_is_paid,
            final_ticket_price,
            event_id,
        ))

        updated_event_id = (
            cur.fetchone()[0]
        )

        conn.commit()

        return jsonify({
            "message": (
                "Event updated successfully."
            ),

            "event_id":
                updated_event_id,

            "is_paid":
                final_is_paid,

            "ticket_price":
                float(
                    final_ticket_price
                ),
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


# ==============================
# CANCEL EVENT
# ==============================

@events_bp.route(
    "/<int:event_id>/cancel",
    methods=["PUT"]
)
def cancel_event(
    event_id
):
    data = request.get_json() or {}

    organizer_id = data.get(
        "organizer_id"
    )

    if not organizer_id:
        return jsonify({
            "message":
                "Organizer ID is required."
        }), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                event_id,
                organizer_id,
                status
            FROM events
            WHERE event_id = %s;
        """, (
            event_id,
        ))

        event = cur.fetchone()

        if not event:
            return jsonify({
                "message":
                    "Event not found."
            }), 404

        if (
            event[1]
            != int(organizer_id)
        ):
            return jsonify({
                "message": (
                    "You are not allowed "
                    "to cancel this event."
                )
            }), 403

        if (
            event[2]
            == "cancelled"
        ):
            return jsonify({
                "message": (
                    "This event is already "
                    "cancelled."
                )
            }), 400

        cur.execute("""
            UPDATE events
            SET status = 'cancelled'
            WHERE event_id = %s;
        """, (
            event_id,
        ))

        conn.commit()

        return jsonify({
            "message": (
                "Event cancelled successfully."
            ),

            "event_id":
                event_id,

            "status":
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


# ==============================
# GET SINGLE EVENT
# ==============================

@events_bp.route(
    "/<int:event_id>",
    methods=["GET"]
)
def get_event(
    event_id
):
    conn = None
    cur = None

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
                ec.category_name,
                u.full_name,
                e.category_id,
                e.organizer_id,
                e.is_paid,
                e.ticket_price
            FROM events e

            LEFT JOIN event_categories ec
                ON e.category_id =
                   ec.category_id

            LEFT JOIN users u
                ON e.organizer_id =
                   u.user_id

            WHERE e.event_id = %s;
        """, (
            event_id,
        ))

        row = cur.fetchone()

        if not row:
            return jsonify({
                "message":
                    "Event not found"
            }), 404

        return jsonify({
            "event_id":
                row[0],

            "event_name":
                row[1],

            "description":
                row[2],

            "location":
                row[3],

            "event_date": (
                row[4].isoformat()
                if row[4]
                else None
            ),

            "end_date": (
                row[5].isoformat()
                if row[5]
                else None
            ),

            "capacity":
                row[6],

            "status":
                row[7],

            "category_name":
                row[8],

            "organizer_name":
                row[9],

            "category_id":
                row[10],

            "organizer_id":
                row[11],

            "is_paid":
                bool(row[12]),

            "ticket_price": (
                float(row[13])
                if row[13] is not None
                else 0.0
            ),
        }), 200

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()