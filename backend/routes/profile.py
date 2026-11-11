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
    __name__,
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
    "profile_photos",
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
    exist_ok=True,
)


# =========================================
# DATABASE
# =========================================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv(
            "DB_PORT",
            "5432",
        ),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv(
            "DB_PASSWORD"
        ),
    )


# =========================================
# PHOTO HELPERS
# =========================================

def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(
            ".",
            1,
        )[1].lower()
        in ALLOWED_EXTENSIONS
    )


def build_profile_photo_url(filename):
    """
    Full URL.

    Useful for API clients that want to use
    the returned value directly as an image src.
    """

    if not filename:
        return None

    return (
        "http://127.0.0.1:5000"
        f"/api/profile/photo/{filename}"
    )


def build_profile_photo_path(filename):
    """
    Relative path.

    organizerProfile.jsx currently adds the
    backend host itself, so the flat response
    uses this version.
    """

    if not filename:
        return None

    return (
        f"api/profile/photo/{filename}"
    )


# =========================================
# SERVE PROFILE PHOTO
# =========================================

@profile_bp.route(
    "/photo/<path:filename>",
    methods=["GET"],
)
def get_profile_photo(filename):
    return send_from_directory(
        UPLOAD_FOLDER,
        filename,
    )


# =========================================
# GET PROFILE
# =========================================

@profile_bp.route(
    "/<int:user_id>",
    methods=["GET"],
)
def get_profile(user_id):
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # =====================================
        # USER DETAILS
        # =====================================

        cur.execute(
            """
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
            """,
            (user_id,),
        )

        user_row = cur.fetchone()

        if not user_row:
            return jsonify({
                "success": False,
                "message": "User not found.",
            }), 404

        user_id_value = user_row[0]
        full_name = user_row[1]
        email = user_row[2]
        user_type = user_row[3]
        phone_number = user_row[4]
        institution = user_row[5]
        year_of_study = user_row[6]
        profile_photo_filename = user_row[7]
        created_at = user_row[8]
        last_login = user_row[9]

        # =====================================
        # INTERESTS
        # =====================================

        cur.execute(
            """
            SELECT
                ec.category_id,
                ec.category_name
            FROM user_preferences up
            JOIN event_categories ec
                ON up.category_id =
                   ec.category_id
            WHERE up.user_id = %s
            ORDER BY
                ec.category_name ASC;
            """,
            (user_id,),
        )

        interest_rows = cur.fetchall()

        interests = [
            {
                "category_id": row[0],
                "category_name": row[1],
            }
            for row in interest_rows
        ]

        # =====================================
        # EVENTS BOOKED
        # =====================================

        cur.execute(
            """
            SELECT COUNT(*)
            FROM bookings
            WHERE user_id = %s
              AND booking_status
                  != 'cancelled';
            """,
            (user_id,),
        )

        events_booked = (
            cur.fetchone()[0]
        )

        # =====================================
        # SAVED EVENTS
        # =====================================

        cur.execute(
            """
            SELECT COUNT(*)
            FROM bookmarks
            WHERE user_id = %s;
            """,
            (user_id,),
        )

        saved_events = (
            cur.fetchone()[0]
        )

        # =====================================
        # ATTENDED EVENTS
        # =====================================

        cur.execute(
            """
            SELECT COUNT(*)
            FROM bookings
            WHERE user_id = %s
              AND booking_status =
                  'attended';
            """,
            (user_id,),
        )

        attended_events = (
            cur.fetchone()[0]
        )

        # =====================================
        # PROFILE OBJECT
        # =====================================

        profile = {
            "user_id":
                user_id_value,

            "full_name":
                full_name,

            "email":
                email,

            "user_type":
                user_type,

            "phone_number":
                phone_number,

            "institution":
                institution,

            "year_of_study":
                year_of_study,

            "profile_photo":
                build_profile_photo_url(
                    profile_photo_filename
                ),

            "created_at":
                created_at.isoformat()
                if created_at
                else None,

            "last_login":
                last_login.isoformat()
                if last_login
                else None,
        }

        # =====================================
        # RESPONSE
        #
        # We intentionally return BOTH:
        #
        # 1. profile {...}
        #    for student profile compatibility
        #
        # 2. flat fields
        #    for organizerProfile.jsx
        # =====================================

        return jsonify({
            "success": True,

            # ---------------------------------
            # FLAT ORGANIZER-COMPATIBLE DATA
            # ---------------------------------

            "user_id":
                user_id_value,

            "full_name":
                full_name,

            "email":
                email,

            "user_type":
                user_type,

            "phone_number":
                phone_number,

            "institution":
                institution,

            "year_of_study":
                year_of_study,

            # Organizer frontend currently adds
            # http://127.0.0.1:5000 itself.
            "profile_photo":
                build_profile_photo_path(
                    profile_photo_filename
                ),

            "created_at":
                created_at.isoformat()
                if created_at
                else None,

            "last_login":
                last_login.isoformat()
                if last_login
                else None,

            # ---------------------------------
            # ORIGINAL STRUCTURED RESPONSE
            # ---------------------------------

            "profile":
                profile,

            "interests":
                interests,

            "activity": {
                "events_booked":
                    events_booked,

                "saved_events":
                    saved_events,

                "attended_events":
                    attended_events,
            },
        }), 200

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
    methods=["PUT"],
)
def update_profile(user_id):
    conn = None
    cur = None

    try:
        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        # =====================================
        # REQUIRED FIELDS
        # =====================================

        full_name = (
            str(
                data.get(
                    "full_name",
                    "",
                )
                or ""
            )
            .strip()
        )

        email = (
            str(
                data.get(
                    "email",
                    "",
                )
                or ""
            )
            .strip()
            .lower()
        )

        # =====================================
        # OPTIONAL FIELDS
        # =====================================

        phone_number = (
            data.get(
                "phone_number"
            )
        )

        if phone_number is not None:
            phone_number = (
                str(phone_number)
                .strip()
                or None
            )

        institution = (
            data.get(
                "institution"
            )
        )

        if institution is not None:
            institution = (
                str(institution)
                .strip()
                or None
            )

        # IMPORTANT:
        # Organizer profile does not send
        # year_of_study.
        #
        # We therefore detect whether the field
        # was actually supplied instead of
        # blindly replacing it with NULL.

        year_supplied = (
            "year_of_study"
            in data
        )

        year_of_study = (
            data.get(
                "year_of_study"
            )
            if year_supplied
            else None
        )

        if (
            year_supplied
            and isinstance(
                year_of_study,
                str,
            )
        ):
            year_of_study = (
                year_of_study.strip()
                or None
            )

        # =====================================
        # VALIDATION
        # =====================================

        if not full_name:
            return jsonify({
                "success": False,
                "message":
                    "Full name is required.",
            }), 400

        if not email:
            return jsonify({
                "success": False,
                "message":
                    "Email address is required.",
            }), 400

        if (
            "@" not in email
            or "." not in email.split(
                "@"
            )[-1]
        ):
            return jsonify({
                "success": False,
                "message":
                    "Enter a valid email address.",
            }), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # =====================================
        # VERIFY USER
        # =====================================

        cur.execute(
            """
            SELECT
                user_id,
                year_of_study
            FROM users
            WHERE user_id = %s;
            """,
            (user_id,),
        )

        existing_user = (
            cur.fetchone()
        )

        if not existing_user:
            return jsonify({
                "success": False,
                "message":
                    "User not found.",
            }), 404

        existing_year = (
            existing_user[1]
        )

        # Preserve existing student year
        # when organizer/profile caller
        # does not supply the field.

        final_year_of_study = (
            year_of_study
            if year_supplied
            else existing_year
        )

        # =====================================
        # EMAIL MUST BE UNIQUE
        # =====================================

        cur.execute(
            """
            SELECT user_id
            FROM users
            WHERE LOWER(email) =
                  LOWER(%s)
              AND user_id != %s;
            """,
            (
                email,
                user_id,
            ),
        )

        if cur.fetchone():
            return jsonify({
                "success": False,
                "message":
                    "That email address is already in use.",
            }), 409

        # =====================================
        # UPDATE USER
        # =====================================

        cur.execute(
            """
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
                user_type,
                phone_number,
                institution,
                year_of_study,
                profile_photo,
                created_at,
                last_login;
            """,
            (
                full_name,
                email,
                phone_number,
                institution,
                final_year_of_study,
                user_id,
            ),
        )

        updated = (
            cur.fetchone()
        )

        conn.commit()

        updated_profile = {
            "user_id":
                updated[0],

            "full_name":
                updated[1],

            "email":
                updated[2],

            "user_type":
                updated[3],

            "phone_number":
                updated[4],

            "institution":
                updated[5],

            "year_of_study":
                updated[6],

            "profile_photo":
                build_profile_photo_url(
                    updated[7]
                ),

            "created_at":
                updated[8].isoformat()
                if updated[8]
                else None,

            "last_login":
                updated[9].isoformat()
                if updated[9]
                else None,
        }

        return jsonify({
            "success": True,

            "message":
                "Profile updated successfully.",

            # ---------------------------------
            # FLAT ORGANIZER RESPONSE
            # ---------------------------------

            "user_id":
                updated[0],

            "full_name":
                updated[1],

            "email":
                updated[2],

            "user_type":
                updated[3],

            "phone_number":
                updated[4],

            "institution":
                updated[5],

            "year_of_study":
                updated[6],

            "profile_photo":
                build_profile_photo_path(
                    updated[7]
                ),

            "created_at":
                updated[8].isoformat()
                if updated[8]
                else None,

            "last_login":
                updated[9].isoformat()
                if updated[9]
                else None,

            # ---------------------------------
            # ORIGINAL STRUCTURED RESPONSE
            # ---------------------------------

            "profile":
                updated_profile,
        }), 200

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
    methods=["POST"],
)
def upload_profile_photo(user_id):
    conn = None
    cur = None

    new_filepath = None

    try:
        if (
            "photo"
            not in request.files
        ):
            return jsonify({
                "success": False,
                "message":
                    "No profile photo was provided.",
            }), 400

        photo = (
            request.files[
                "photo"
            ]
        )

        if (
            not photo
            or not photo.filename
        ):
            return jsonify({
                "success": False,
                "message":
                    "Please choose an image.",
            }), 400

        if not allowed_file(
            photo.filename
        ):
            return jsonify({
                "success": False,
                "message": (
                    "Profile photo must be "
                    "PNG, JPG, JPEG or WEBP."
                ),
            }), 400

        # =====================================
        # FILE SIZE CHECK
        # =====================================

        photo.seek(
            0,
            os.SEEK_END,
        )

        file_size = (
            photo.tell()
        )

        photo.seek(0)

        if (
            file_size
            > MAX_FILE_SIZE
        ):
            return jsonify({
                "success": False,
                "message":
                    "Profile photo must be smaller than 5 MB.",
            }), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # =====================================
        # VERIFY USER
        # =====================================

        cur.execute(
            """
            SELECT profile_photo
            FROM users
            WHERE user_id = %s;
            """,
            (user_id,),
        )

        existing_user = (
            cur.fetchone()
        )

        if not existing_user:
            return jsonify({
                "success": False,
                "message":
                    "User not found.",
            }), 404

        old_photo = (
            existing_user[0]
        )

        # =====================================
        # CREATE SAFE FILENAME
        # =====================================

        original_filename = (
            secure_filename(
                photo.filename
            )
        )

        extension = (
            original_filename
            .rsplit(
                ".",
                1,
            )[1]
            .lower()
        )

        new_filename = (
            f"user_{user_id}_"
            f"{uuid.uuid4().hex}."
            f"{extension}"
        )

        new_filepath = (
            os.path.join(
                UPLOAD_FOLDER,
                new_filename,
            )
        )

        # =====================================
        # SAVE PHOTO
        # =====================================

        photo.save(
            new_filepath
        )

        cur.execute(
            """
            UPDATE users
            SET profile_photo = %s
            WHERE user_id = %s;
            """,
            (
                new_filename,
                user_id,
            ),
        )

        conn.commit()

        # =====================================
        # DELETE OLD PHOTO
        # =====================================

        if old_photo:
            old_filepath = (
                os.path.join(
                    UPLOAD_FOLDER,
                    old_photo,
                )
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

            # Flat organizer-compatible path
            "profile_photo":
                build_profile_photo_path(
                    new_filename
                ),

            # Also provide full URL for
            # other consumers.
            "profile_photo_url":
                build_profile_photo_url(
                    new_filename
                ),
        }), 200

    except Exception as error:
        if conn:
            conn.rollback()

        # If the DB update failed after
        # saving a new file, remove the
        # orphaned file.
        if (
            new_filepath
            and os.path.isfile(
                new_filepath
            )
        ):
            try:
                os.remove(
                    new_filepath
                )

            except OSError:
                pass

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
    methods=["PUT"],
)
def change_password(user_id):
    conn = None
    cur = None

    try:
        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        current_password = (
            str(
                data.get(
                    "current_password",
                    "",
                )
                or ""
            )
        )

        new_password = (
            str(
                data.get(
                    "new_password",
                    "",
                )
                or ""
            )
        )

        # confirm_password is optional at
        # API level because organizerProfile
        # already validates it before sending.
        confirm_password = (
            data.get(
                "confirm_password"
            )
        )

        if (
            not current_password
            or not new_password
        ):
            return jsonify({
                "success": False,
                "message":
                    "Current and new password are required.",
            }), 400

        if (
            confirm_password
            is not None
            and new_password
            != str(
                confirm_password
            )
        ):
            return jsonify({
                "success": False,
                "message":
                    "The new passwords do not match.",
            }), 400

        if (
            len(new_password)
            < 6
        ):
            return jsonify({
                "success": False,
                "message":
                    "New password must contain at least 6 characters.",
            }), 400

        if (
            current_password
            == new_password
        ):
            return jsonify({
                "success": False,
                "message":
                    "New password must be different from the current password.",
            }), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # =====================================
        # FIND PASSWORD COLUMN
        # =====================================

        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name IN (
                  'password_hash',
                  'password'
              );
            """
        )

        columns = {
            row[0]
            for row
            in cur.fetchall()
        }

        if (
            "password_hash"
            in columns
        ):
            password_column = (
                "password_hash"
            )

        elif (
            "password"
            in columns
        ):
            password_column = (
                "password"
            )

        else:
            return jsonify({
                "success": False,
                "message":
                    "Password column could not be identified.",
            }), 500

        # =====================================
        # GET EXISTING PASSWORD
        # =====================================

        cur.execute(
            f"""
            SELECT {password_column}
            FROM users
            WHERE user_id = %s;
            """,
            (user_id,),
        )

        row = (
            cur.fetchone()
        )

        if not row:
            return jsonify({
                "success": False,
                "message":
                    "User not found.",
            }), 404

        stored_password = (
            row[0]
        )

        if not stored_password:
            return jsonify({
                "success": False,
                "message":
                    "No password is configured for this account.",
            }), 400

        # =====================================
        # VERIFY CURRENT PASSWORD
        # =====================================

        try:
            password_correct = (
                check_password_hash(
                    stored_password,
                    current_password,
                )
            )

        except ValueError:
            password_correct = (
                stored_password
                == current_password
            )

        if not password_correct:
            return jsonify({
                "success": False,
                "message":
                    "Current password is incorrect.",
            }), 401

        # =====================================
        # CREATE NEW HASH
        # =====================================

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
                user_id,
            ),
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message":
                "Password changed successfully.",
        }), 200

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