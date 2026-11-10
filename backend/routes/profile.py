import os
import uuid

import psycopg

from flask import (
    Blueprint,
    jsonify,
    request,
    send_from_directory,
)

from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

from werkzeug.utils import secure_filename


profile_bp = Blueprint(
    "profile",
    __name__
)


# =========================================
# SETTINGS
# =========================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "uploads",
    "profile_photos"
)

ALLOWED_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp",
}

MAX_FILE_SIZE = 5 * 1024 * 1024


os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


# =========================================
# DATABASE
# =========================================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# =========================================
# PHOTO HELPERS
# =========================================

def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(
            ".",
            1
        )[1].lower()
        in ALLOWED_EXTENSIONS
    )


def build_profile_photo_url(filename):
    if not filename:
        return None

    return (
        "http://127.0.0.1:5000"
        f"/api/profile/photo/{filename}"
    )


# =========================================
# SERVE PROFILE PHOTO
# =========================================

@profile_bp.route(
    "/photo/<path:filename>",
    methods=["GET"]
)
def get_profile_photo(filename):
    return send_from_directory(
        UPLOAD_FOLDER,
        filename
    )


# =========================================
# GET PROFILE
# =========================================

@profile_bp.route(
    "/<int:user_id>",
    methods=["GET"]
)
def get_profile(user_id):
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # USER DETAILS
        cur.execute("""
            SELECT
                user_id,
                full_name,
                email,
                user_type,
                phone_number,
                institution,
                year_of_study,
                profile_photo,
                created_at,
                last_login
            FROM users
            WHERE user_id = %s;
        """, (user_id,))

        user_row = cur.fetchone()

        if not user_row:
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        # INTERESTS
        cur.execute("""
            SELECT
                ec.category_id,
                ec.category_name
            FROM user_preferences up
            JOIN event_categories ec
                ON up.category_id = ec.category_id
            WHERE up.user_id = %s
            ORDER BY ec.category_name ASC;
        """, (user_id,))

        interest_rows = cur.fetchall()

        interests = [
            {
                "category_id": row[0],
                "category_name": row[1],
            }
            for row in interest_rows
        ]

        # EVENTS BOOKED
        cur.execute("""
            SELECT COUNT(*)
            FROM bookings
            WHERE user_id = %s
              AND booking_status != 'cancelled';
        """, (user_id,))

        events_booked = cur.fetchone()[0]

        # SAVED EVENTS
        cur.execute("""
            SELECT COUNT(*)
            FROM bookmarks
            WHERE user_id = %s;
        """, (user_id,))

        saved_events = cur.fetchone()[0]

        # ATTENDED EVENTS
        cur.execute("""
            SELECT COUNT(*)
            FROM bookings
            WHERE user_id = %s
              AND booking_status = 'attended';
        """, (user_id,))

        attended_events = cur.fetchone()[0]

        return jsonify({
            "success": True,

            "profile": {
                "user_id": user_row[0],
                "full_name": user_row[1],
                "email": user_row[2],
                "user_type": user_row[3],
                "phone_number": user_row[4],
                "institution": user_row[5],
                "year_of_study": user_row[6],

                "profile_photo":
                    build_profile_photo_url(
                        user_row[7]
                    ),

                "created_at":
                    user_row[8].isoformat()
                    if user_row[8]
                    else None,

                "last_login":
                    user_row[9].isoformat()
                    if user_row[9]
                    else None,
            },

            "interests": interests,

            "activity": {
                "events_booked":
                    events_booked,

                "saved_events":
                    saved_events,

                "attended_events":
                    attended_events,
            },
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error),
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# =========================================
# UPDATE PROFILE DETAILS
# =========================================

@profile_bp.route(
    "/<int:user_id>",
    methods=["PUT"]
)
def update_profile(user_id):
    conn = None
    cur = None

    try:
        data = request.get_json(
            silent=True
        ) or {}

        full_name = (
            data.get(
                "full_name",
                ""
            )
            .strip()
        )

        email = (
            data.get(
                "email",
                ""
            )
            .strip()
            .lower()
        )

        phone_number = (
            data.get("phone_number")
        )

        institution = (
            data.get("institution")
        )

        year_of_study = (
            data.get("year_of_study")
        )

        if not full_name:
            return jsonify({
                "success": False,
                "message":
                    "Full name is required."
            }), 400

        if not email:
            return jsonify({
                "success": False,
                "message":
                    "Email address is required."
            }), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # VERIFY USER
        cur.execute("""
            SELECT user_id
            FROM users
            WHERE user_id = %s;
        """, (user_id,))

        if not cur.fetchone():
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        # EMAIL MUST BE UNIQUE
        cur.execute("""
            SELECT user_id
            FROM users
            WHERE LOWER(email) = LOWER(%s)
              AND user_id != %s;
        """, (
            email,
            user_id
        ))

        if cur.fetchone():
            return jsonify({
                "success": False,
                "message":
                    "That email address is already in use."
            }), 409

        # UPDATE USER
        cur.execute("""
            UPDATE users
            SET
                full_name = %s,
                email = %s,
                phone_number = %s,
                institution = %s,
                year_of_study = %s
            WHERE user_id = %s
            RETURNING
                user_id,
                full_name,
                email,
                phone_number,
                institution,
                year_of_study;
        """, (
            full_name,
            email,
            phone_number,
            institution,
            year_of_study,
            user_id
        ))

        updated = cur.fetchone()

        conn.commit()

        return jsonify({
            "success": True,

            "message":
                "Profile updated successfully.",

            "profile": {
                "user_id": updated[0],
                "full_name": updated[1],
                "email": updated[2],
                "phone_number": updated[3],
                "institution": updated[4],
                "year_of_study": updated[5],
            }
        })

    except Exception as error:
        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": str(error),
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# =========================================
# UPLOAD PROFILE PHOTO
# =========================================

@profile_bp.route(
    "/<int:user_id>/photo",
    methods=["POST"]
)
def upload_profile_photo(user_id):
    conn = None
    cur = None

    try:
        if "photo" not in request.files:
            return jsonify({
                "success": False,
                "message":
                    "No profile photo was provided."
            }), 400

        photo = request.files["photo"]

        if (
            not photo
            or not photo.filename
        ):
            return jsonify({
                "success": False,
                "message":
                    "Please choose an image."
            }), 400

        if not allowed_file(
            photo.filename
        ):
            return jsonify({
                "success": False,
                "message": (
                    "Profile photo must be "
                    "PNG, JPG, JPEG or WEBP."
                )
            }), 400

        photo.seek(
            0,
            os.SEEK_END
        )

        file_size = photo.tell()

        photo.seek(0)

        if file_size > MAX_FILE_SIZE:
            return jsonify({
                "success": False,
                "message":
                    "Profile photo must be smaller than 5 MB."
            }), 400

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT profile_photo
            FROM users
            WHERE user_id = %s;
        """, (user_id,))

        existing_user = cur.fetchone()

        if not existing_user:
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        old_photo = existing_user[0]

        original_filename = (
            secure_filename(
                photo.filename
            )
        )

        extension = (
            original_filename
            .rsplit(".", 1)[1]
            .lower()
        )

        new_filename = (
            f"user_{user_id}_"
            f"{uuid.uuid4().hex}."
            f"{extension}"
        )

        filepath = os.path.join(
            UPLOAD_FOLDER,
            new_filename
        )

        photo.save(filepath)

        cur.execute("""
            UPDATE users
            SET profile_photo = %s
            WHERE user_id = %s;
        """, (
            new_filename,
            user_id
        ))

        conn.commit()

        if old_photo:
            old_filepath = os.path.join(
                UPLOAD_FOLDER,
                old_photo
            )

            if os.path.isfile(
                old_filepath
            ):
                try:
                    os.remove(
                        old_filepath
                    )
                except OSError:
                    pass

        return jsonify({
            "success": True,

            "message":
                "Profile photo updated successfully.",

            "profile_photo":
                build_profile_photo_url(
                    new_filename
                ),
        })

    except Exception as error:
        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": str(error),
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# =========================================
# CHANGE PASSWORD
# =========================================

@profile_bp.route(
    "/<int:user_id>/password",
    methods=["PUT"]
)
def change_password(user_id):
    conn = None
    cur = None

    try:
        data = request.get_json(
            silent=True
        ) or {}

        current_password = (
            data.get(
                "current_password",
                ""
            )
        )

        new_password = (
            data.get(
                "new_password",
                ""
            )
        )

        confirm_password = (
            data.get(
                "confirm_password",
                ""
            )
        )

        if (
            not current_password
            or not new_password
            or not confirm_password
        ):
            return jsonify({
                "success": False,
                "message":
                    "Complete all password fields."
            }), 400

        if (
            new_password
            != confirm_password
        ):
            return jsonify({
                "success": False,
                "message":
                    "The new passwords do not match."
            }), 400

        if len(new_password) < 6:
            return jsonify({
                "success": False,
                "message":
                    "New password must contain at least 6 characters."
            }), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # Find whether your existing users table
        # uses password_hash or password.
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name IN (
                  'password_hash',
                  'password'
              );
        """)

        columns = {
            row[0]
            for row in cur.fetchall()
        }

        if "password_hash" in columns:
            password_column = (
                "password_hash"
            )

        elif "password" in columns:
            password_column = "password"

        else:
            return jsonify({
                "success": False,
                "message":
                    "Password column could not be identified."
            }), 500

        cur.execute(
            f"""
            SELECT {password_column}
            FROM users
            WHERE user_id = %s;
            """,
            (user_id,)
        )

        row = cur.fetchone()

        if not row:
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        stored_password = row[0]

        if not check_password_hash(
            stored_password,
            current_password
        ):
            return jsonify({
                "success": False,
                "message":
                    "Current password is incorrect."
            }), 401

        new_password_hash = (
            generate_password_hash(
                new_password
            )
        )

        cur.execute(
            f"""
            UPDATE users
            SET {password_column} = %s
            WHERE user_id = %s;
            """,
            (
                new_password_hash,
                user_id
            )
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message":
                "Password changed successfully.",
        })

    except Exception as error:
        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "message": str(error),
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()