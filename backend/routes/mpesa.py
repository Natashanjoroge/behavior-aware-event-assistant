from flask import Blueprint, jsonify, request
from datetime import datetime
import base64
import os
import uuid

import psycopg
import requests


mpesa_bp = Blueprint("mpesa", __name__)


# ==============================
# DATABASE
# ==============================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# ==============================
# CONFIG
# ==============================

def get_mpesa_base_url():
    environment = os.getenv(
        "MPESA_ENV",
        "sandbox"
    ).lower()

    if environment == "production":
        return "https://api.safaricom.co.ke"

    return "https://sandbox.safaricom.co.ke"


def get_required_setting(name):
    value = os.getenv(name)

    if not value:
        raise ValueError(
            f"{name} is missing from .env"
        )

    return value


# ==============================
# PHONE NUMBER
# ==============================

def normalize_phone_number(phone):
    if not phone:
        return None

    phone = str(phone).strip()

    phone = (
        phone.replace(" ", "")
        .replace("-", "")
        .replace("+", "")
    )

    if phone.startswith("0"):
        phone = "254" + phone[1:]

    elif phone.startswith("7"):
        phone = "254" + phone

    elif phone.startswith("1"):
        phone = "254" + phone

    if not phone.startswith("254"):
        return None

    if len(phone) != 12:
        return None

    if not phone.isdigit():
        return None

    return phone


# ==============================
# ACCESS TOKEN
# ==============================

def get_access_token():
    consumer_key = get_required_setting(
        "MPESA_CONSUMER_KEY"
    )

    consumer_secret = get_required_setting(
        "MPESA_CONSUMER_SECRET"
    )

    base_url = get_mpesa_base_url()

    response = requests.get(
        (
            f"{base_url}/oauth/v1/generate"
            "?grant_type=client_credentials"
        ),
        auth=(
            consumer_key,
            consumer_secret
        ),
        timeout=30,
    )

    response.raise_for_status()

    data = response.json()

    access_token = data.get(
        "access_token"
    )

    if not access_token:
        raise ValueError(
            "Daraja did not return an access token."
        )

    return access_token


# ==============================
# STK PASSWORD
# ==============================

def generate_stk_password(
    shortcode,
    passkey,
    timestamp
):
    raw_value = (
        f"{shortcode}"
        f"{passkey}"
        f"{timestamp}"
    )

    encoded = base64.b64encode(
        raw_value.encode("utf-8")
    )

    return encoded.decode("utf-8")


# ==============================
# TICKET HELPER
# ==============================

def ensure_ticket(
    cur,
    booking_id
):
    cur.execute("""
        SELECT
            ticket_id,
            ticket_code,
            ticket_status
        FROM tickets
        WHERE booking_id = %s;
    """, (
        booking_id,
    ))

    existing_ticket = cur.fetchone()

    if existing_ticket:
        return {
            "ticket_id":
                existing_ticket[0],

            "ticket_code":
                existing_ticket[1],

            "ticket_status":
                existing_ticket[2],
        }

    ticket_code = (
        "EVT-" +
        uuid.uuid4()
        .hex[:8]
        .upper()
    )

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
            ticket_status;
    """, (
        booking_id,
        ticket_code,
    ))

    ticket = cur.fetchone()

    return {
        "ticket_id":
            ticket[0],

        "ticket_code":
            ticket[1],

        "ticket_status":
            ticket[2],
    }


# ==============================
# COMPLETE PAYMENT HELPER
# ==============================

def complete_payment(
    cur,
    payment_id,
    booking_id,
    result_code=0,
    result_description=None,
    merchant_request_id=None,
    receipt_number=None,
    transaction_date=None,
    amount=None,
    phone_number=None,
):
    cur.execute("""
        UPDATE payments
        SET
            merchant_request_id =
                COALESCE(
                    %s,
                    merchant_request_id
                ),

            mpesa_receipt_number =
                COALESCE(
                    %s,
                    mpesa_receipt_number
                ),

            transaction_date =
                COALESCE(
                    %s,
                    transaction_date
                ),

            result_code = %s,

            result_description =
                COALESCE(
                    %s,
                    result_description
                ),

            payment_status = 'completed',

            amount =
                COALESCE(
                    %s,
                    amount
                ),

            phone_number =
                COALESCE(
                    %s,
                    phone_number
                ),

            completed_at =
                COALESCE(
                    completed_at,
                    CURRENT_TIMESTAMP
                ),

            updated_at =
                CURRENT_TIMESTAMP

        WHERE payment_id = %s;
    """, (
        merchant_request_id,
        receipt_number,
        (
            str(transaction_date)
            if transaction_date
            else None
        ),
        result_code,
        result_description,
        amount,
        (
            str(phone_number)
            if phone_number
            else None
        ),
        payment_id,
    ))

    cur.execute("""
        UPDATE bookings
        SET
            booking_status = 'confirmed',
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = %s;
    """, (
        booking_id,
    ))

    return ensure_ticket(
        cur,
        booking_id
    )


# ==============================
# FAIL PAYMENT HELPER
# ==============================

def fail_payment(
    cur,
    payment_id,
    booking_id,
    result_code,
    result_description,
    merchant_request_id=None,
):
    cur.execute("""
        UPDATE payments
        SET
            merchant_request_id =
                COALESCE(
                    %s,
                    merchant_request_id
                ),

            result_code = %s,

            result_description = %s,

            payment_status = 'failed',

            updated_at =
                CURRENT_TIMESTAMP

        WHERE payment_id = %s;
    """, (
        merchant_request_id,
        result_code,
        result_description,
        payment_id,
    ))

    cur.execute("""
        UPDATE bookings
        SET
            booking_status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = %s
          AND booking_status = 'pending';
    """, (
        booking_id,
    ))


# ==============================
# STK QUERY
# ==============================

def query_stk_status(
    checkout_request_id
):
    shortcode = get_required_setting(
        "MPESA_SHORTCODE"
    )

    passkey = get_required_setting(
        "MPESA_PASSKEY"
    )

    timestamp = datetime.now().strftime(
        "%Y%m%d%H%M%S"
    )

    password = generate_stk_password(
        shortcode,
        passkey,
        timestamp
    )

    access_token = get_access_token()

    base_url = get_mpesa_base_url()

    payload = {
        "BusinessShortCode":
            shortcode,

        "Password":
            password,

        "Timestamp":
            timestamp,

        "CheckoutRequestID":
            checkout_request_id,
    }

    headers = {
        "Authorization":
            f"Bearer {access_token}",

        "Content-Type":
            "application/json",
    }

    response = requests.post(
        (
            f"{base_url}"
            "/mpesa/stkpushquery/v1/query"
        ),
        json=payload,
        headers=headers,
        timeout=30,
    )

    try:
        response_data = response.json()

    except ValueError:
        response_data = {
            "raw_response":
                response.text
        }

    return (
        response.status_code,
        response_data
    )


# ==============================
# RECONCILE PENDING PAYMENT
# ==============================

def reconcile_payment(
    payment_id
):
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                payment_id,
                booking_id,
                checkout_request_id,
                merchant_request_id,
                payment_status
            FROM payments
            WHERE payment_id = %s
            FOR UPDATE;
        """, (
            payment_id,
        ))

        payment = cur.fetchone()

        if not payment:
            return None

        booking_id = payment[1]

        checkout_request_id = (
            payment[2]
        )

        merchant_request_id = (
            payment[3]
        )

        current_status = (
            payment[4]
        )

        if current_status != "pending":
            return {
                "changed": False,
                "payment_status":
                    current_status,
            }

        if not checkout_request_id:
            return {
                "changed": False,
                "payment_status":
                    "pending",
                "message": (
                    "No CheckoutRequestID "
                    "is available."
                ),
            }

        status_code, query_data = (
            query_stk_status(
                checkout_request_id
            )
        )

        if status_code < 200 or status_code >= 300:
            return {
                "changed": False,
                "payment_status":
                    "pending",
                "daraja_response":
                    query_data,
            }

        response_code = str(
            query_data.get(
                "ResponseCode",
                ""
            )
        )

        result_code = query_data.get(
            "ResultCode"
        )

        result_description = (
            query_data.get(
                "ResultDesc"
            )
            or
            query_data.get(
                "ResponseDescription"
            )
        )

        query_merchant_request_id = (
            query_data.get(
                "MerchantRequestID"
            )
            or
            merchant_request_id
        )

        # ==============================
        # STILL PROCESSING
        # ==============================

        if result_code is None:
            return {
                "changed": False,
                "payment_status":
                    "pending",
                "response_code":
                    response_code,
                "daraja_response":
                    query_data,
            }

        try:
            numeric_result_code = int(
                result_code
            )

        except (
            ValueError,
            TypeError
        ):
            return {
                "changed": False,
                "payment_status":
                    "pending",
                "daraja_response":
                    query_data,
            }

        # ==============================
        # PAYMENT SUCCESS
        # ==============================

        if numeric_result_code == 0:
            ticket = complete_payment(
                cur=cur,
                payment_id=payment_id,
                booking_id=booking_id,
                result_code=0,
                result_description=(
                    result_description
                    or
                    "M-Pesa payment completed."
                ),
                merchant_request_id=(
                    query_merchant_request_id
                ),
            )

            conn.commit()

            return {
                "changed": True,
                "payment_status":
                    "completed",
                "booking_status":
                    "confirmed",
                "ticket":
                    ticket,
                "daraja_response":
                    query_data,
            }

        # ==============================
        # PAYMENT FAILED / CANCELLED
        # ==============================

        fail_payment(
            cur=cur,
            payment_id=payment_id,
            booking_id=booking_id,
            result_code=(
                numeric_result_code
            ),
            result_description=(
                result_description
                or
                "M-Pesa payment was not completed."
            ),
            merchant_request_id=(
                query_merchant_request_id
            ),
        )

        conn.commit()

        return {
            "changed": True,
            "payment_status":
                "failed",
            "booking_status":
                "cancelled",
            "result_code":
                numeric_result_code,
            "result_description":
                result_description,
            "daraja_response":
                query_data,
        }

    except requests.RequestException as error:
        if conn:
            conn.rollback()

        return {
            "changed": False,
            "payment_status":
                "pending",
            "message": (
                "Could not query M-Pesa "
                "payment status."
            ),
            "error":
                str(error),
        }

    except Exception as error:
        if conn:
            conn.rollback()

        return {
            "changed": False,
            "payment_status":
                "pending",
            "message":
                str(error),
        }

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# ==============================
# TEST AUTH
# ==============================

@mpesa_bp.route(
    "/auth-test",
    methods=["GET"]
)
def mpesa_auth_test():
    try:
        token = get_access_token()

        return jsonify({
            "message": (
                "Connected to Daraja successfully."
            ),
            "status": "success",
            "token_received": bool(token),
        }), 200

    except requests.RequestException as error:
        return jsonify({
            "message": (
                "Could not authenticate with Daraja."
            ),
            "error": str(error),
        }), 502

    except Exception as error:
        return jsonify({
            "message": str(error)
        }), 500


# ==============================
# STK PUSH
# ==============================

@mpesa_bp.route(
    "/stk-push",
    methods=["POST"]
)
def stk_push():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    event_id = data.get("event_id")
    phone_number = data.get(
        "phone_number"
    )

    if not user_id:
        return jsonify({
            "message":
                "user_id is required."
        }), 400

    if not event_id:
        return jsonify({
            "message":
                "event_id is required."
        }), 400

    normalized_phone = (
        normalize_phone_number(
            phone_number
        )
    )

    if not normalized_phone:
        return jsonify({
            "message": (
                "Enter a valid Kenyan "
                "M-Pesa phone number."
            )
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
                full_name
            FROM users
            WHERE user_id = %s;
        """, (
            user_id,
        ))

        user = cur.fetchone()

        if not user:
            return jsonify({
                "message":
                    "User not found."
            }), 404

        # ==============================
        # CHECK EVENT
        # ==============================

        cur.execute("""
            SELECT
                event_id,
                event_name,
                is_paid,
                ticket_price,
                capacity,
                status,
                event_date
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

        event_name = event[1]
        is_paid = event[2]
        ticket_price = event[3]
        capacity = event[4]
        event_status = event[5]

        if event_status == "cancelled":
            return jsonify({
                "message": (
                    "This event has been "
                    "cancelled."
                )
            }), 400

        if not is_paid:
            return jsonify({
                "message": (
                    "This event is free and "
                    "does not require "
                    "M-Pesa payment."
                )
            }), 400

        if (
            ticket_price is None
            or
            float(ticket_price) <= 0
        ):
            return jsonify({
                "message": (
                    "This event does not have "
                    "a valid ticket price."
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

        existing_booking = (
            cur.fetchone()
        )

        if (
            existing_booking
            and
            existing_booking[1]
            in (
                "confirmed",
                "attended"
            )
        ):
            return jsonify({
                "message": (
                    "You already have a "
                    "confirmed booking for "
                    "this event."
                ),
                "booking_id":
                    existing_booking[0],
            }), 409

        # ==============================
        # CHECK EXISTING PENDING PAYMENT
        # ==============================

        if existing_booking:
            cur.execute("""
                SELECT
                    payment_id,
                    payment_status,
                    checkout_request_id
                FROM payments
                WHERE booking_id = %s
                  AND payment_status = 'pending'
                ORDER BY payment_id DESC
                LIMIT 1;
            """, (
                existing_booking[0],
            ))

            pending_payment = (
                cur.fetchone()
            )

            if pending_payment:
                return jsonify({
                    "message": (
                        "You already have an "
                        "M-Pesa payment waiting "
                        "for confirmation."
                    ),
                    "payment_id":
                        pending_payment[0],
                    "booking_id":
                        existing_booking[0],
                    "checkout_request_id":
                        pending_payment[2],
                    "status":
                        "pending",
                }), 200

        # ==============================
        # CAPACITY
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

            if (
                confirmed_count
                >= capacity
            ):
                return jsonify({
                    "message": (
                        "This event is "
                        "fully booked."
                    )
                }), 400

        # ==============================
        # CREATE / REUSE BOOKING
        # ==============================

        if existing_booking:
            booking_id = (
                existing_booking[0]
            )

            cur.execute("""
                UPDATE bookings
                SET
                    booking_status =
                        'pending',
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE booking_id = %s;
            """, (
                booking_id,
            ))

        else:
            cur.execute("""
                INSERT INTO bookings (
                    user_id,
                    event_id,
                    booking_status
                )
                VALUES (
                    %s,
                    %s,
                    'pending'
                )
                RETURNING booking_id;
            """, (
                user_id,
                event_id,
            ))

            booking_id = (
                cur.fetchone()[0]
            )

        # ==============================
        # DARAJA CONFIG
        # ==============================

        shortcode = (
            get_required_setting(
                "MPESA_SHORTCODE"
            )
        )

        passkey = (
            get_required_setting(
                "MPESA_PASSKEY"
            )
        )

        callback_url = (
            get_required_setting(
                "MPESA_CALLBACK_URL"
            )
        )

        timestamp = (
            datetime.now().strftime(
                "%Y%m%d%H%M%S"
            )
        )

        password = (
            generate_stk_password(
                shortcode,
                passkey,
                timestamp
            )
        )

        access_token = (
            get_access_token()
        )

        base_url = (
            get_mpesa_base_url()
        )

        amount = int(
            round(
                float(
                    ticket_price
                )
            )
        )

        if amount < 1:
            amount = 1

        account_reference = (
            f"EVENTEYE-{event_id}"
        )[:12]

        transaction_description = (
            "Eventeye Ticket"
        )

        payload = {
            "BusinessShortCode":
                shortcode,

            "Password":
                password,

            "Timestamp":
                timestamp,

            "TransactionType":
                "CustomerPayBillOnline",

            "Amount":
                amount,

            "PartyA":
                normalized_phone,

            "PartyB":
                shortcode,

            "PhoneNumber":
                normalized_phone,

            "CallBackURL":
                callback_url,

            "AccountReference":
                account_reference,

            "TransactionDesc":
                transaction_description,
        }

        headers = {
            "Authorization":
                f"Bearer {access_token}",

            "Content-Type":
                "application/json",
        }

        response = requests.post(
            (
                f"{base_url}"
                "/mpesa/stkpush/v1/"
                "processrequest"
            ),
            json=payload,
            headers=headers,
            timeout=30,
        )

        try:
            response_data = (
                response.json()
            )

        except ValueError:
            response_data = {
                "raw_response":
                    response.text
            }

        if not response.ok:
            conn.rollback()

            return jsonify({
                "message": (
                    "M-Pesa STK Push "
                    "request failed."
                ),
                "daraja_response":
                    response_data,
            }), 502

        merchant_request_id = (
            response_data.get(
                "MerchantRequestID"
            )
        )

        checkout_request_id = (
            response_data.get(
                "CheckoutRequestID"
            )
        )

        response_code = str(
            response_data.get(
                "ResponseCode",
                ""
            )
        )

        if (
            response_code != "0"
            or
            not checkout_request_id
        ):
            conn.rollback()

            return jsonify({
                "message": (
                    response_data.get(
                        "ResponseDescription"
                    )
                    or
                    "M-Pesa rejected "
                    "the request."
                ),
                "daraja_response":
                    response_data,
            }), 400

        # ==============================
        # SAVE PAYMENT
        # ==============================

        cur.execute("""
            INSERT INTO payments (
                user_id,
                event_id,
                booking_id,
                phone_number,
                amount,
                merchant_request_id,
                checkout_request_id,
                payment_status
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'pending'
            )
            RETURNING payment_id;
        """, (
            user_id,
            event_id,
            booking_id,
            normalized_phone,
            amount,
            merchant_request_id,
            checkout_request_id,
        ))

        payment_id = (
            cur.fetchone()[0]
        )

        conn.commit()

        return jsonify({
            "message": (
                "M-Pesa prompt sent. "
                "Complete the payment "
                "on your phone."
            ),

            "payment_id":
                payment_id,

            "booking_id":
                booking_id,

            "merchant_request_id":
                merchant_request_id,

            "checkout_request_id":
                checkout_request_id,

            "response_description":
                response_data.get(
                    "ResponseDescription"
                ),

            "customer_message":
                response_data.get(
                    "CustomerMessage"
                ),

            "status":
                "pending",
        }), 200

    except requests.RequestException as error:
        if conn:
            conn.rollback()

        return jsonify({
            "message": (
                "Could not connect to "
                "the Safaricom Daraja API."
            ),
            "error":
                str(error),
        }), 502

    except Exception as error:
        if conn:
            conn.rollback()

        return jsonify({
            "message":
                str(error)
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# ==============================
# CALLBACK
# ==============================

@mpesa_bp.route(
    "/callback",
    methods=["POST"]
)
def mpesa_callback():
    callback_data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    stk_callback = (
        callback_data
        .get(
            "Body",
            {}
        )
        .get(
            "stkCallback",
            {}
        )
    )

    checkout_request_id = (
        stk_callback.get(
            "CheckoutRequestID"
        )
    )

    merchant_request_id = (
        stk_callback.get(
            "MerchantRequestID"
        )
    )

    result_code = (
        stk_callback.get(
            "ResultCode"
        )
    )

    result_description = (
        stk_callback.get(
            "ResultDesc"
        )
    )

    if not checkout_request_id:
        return jsonify({
            "ResultCode": 0,
            "ResultDesc":
                "Callback received."
        }), 200

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                payment_id,
                user_id,
                event_id,
                booking_id,
                payment_status
            FROM payments
            WHERE checkout_request_id = %s
            FOR UPDATE;
        """, (
            checkout_request_id,
        ))

        payment = cur.fetchone()

        if not payment:
            return jsonify({
                "ResultCode": 0,
                "ResultDesc": (
                    "Payment record "
                    "not found."
                )
            }), 200

        payment_id = (
            payment[0]
        )

        booking_id = (
            payment[3]
        )

        # ==============================
        # ALREADY COMPLETED
        # ==============================

        if (
            payment[4]
            == "completed"
        ):
            ensure_ticket(
                cur,
                booking_id
            )

            conn.commit()

            return jsonify({
                "ResultCode": 0,
                "ResultDesc": (
                    "Callback already "
                    "processed."
                )
            }), 200

        # ==============================
        # PAYMENT SUCCESS
        # ==============================

        try:
            numeric_result_code = int(
                result_code
            )

        except (
            ValueError,
            TypeError
        ):
            numeric_result_code = -1

        if numeric_result_code == 0:
            callback_metadata = (
                stk_callback
                .get(
                    "CallbackMetadata",
                    {}
                )
                .get(
                    "Item",
                    []
                )
            )

            metadata = {}

            for item in callback_metadata:
                name = item.get(
                    "Name"
                )

                if "Value" in item:
                    metadata[name] = (
                        item.get(
                            "Value"
                        )
                    )

            receipt_number = (
                metadata.get(
                    "MpesaReceiptNumber"
                )
            )

            transaction_date = (
                metadata.get(
                    "TransactionDate"
                )
            )

            amount = metadata.get(
                "Amount"
            )

            phone_number = (
                metadata.get(
                    "PhoneNumber"
                )
            )

            complete_payment(
                cur=cur,
                payment_id=payment_id,
                booking_id=booking_id,
                result_code=0,
                result_description=(
                    result_description
                ),
                merchant_request_id=(
                    merchant_request_id
                ),
                receipt_number=(
                    receipt_number
                ),
                transaction_date=(
                    transaction_date
                ),
                amount=amount,
                phone_number=(
                    phone_number
                ),
            )

            conn.commit()

        # ==============================
        # PAYMENT FAILED
        # ==============================

        else:
            fail_payment(
                cur=cur,
                payment_id=payment_id,
                booking_id=booking_id,
                result_code=(
                    numeric_result_code
                ),
                result_description=(
                    result_description
                    or
                    "M-Pesa payment failed."
                ),
                merchant_request_id=(
                    merchant_request_id
                ),
            )

            conn.commit()

        return jsonify({
            "ResultCode": 0,
            "ResultDesc": (
                "Callback processed "
                "successfully."
            )
        }), 200

    except Exception as error:
        if conn:
            conn.rollback()

        print(
            "M-Pesa callback error:",
            error
        )

        return jsonify({
            "ResultCode": 0,
            "ResultDesc":
                "Callback received."
        }), 200

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# ==============================
# MANUAL / UI PAYMENT QUERY
# ==============================

@mpesa_bp.route(
    "/query/<int:payment_id>",
    methods=["POST"]
)
def query_payment(
    payment_id
):
    result = reconcile_payment(
        payment_id
    )

    if result is None:
        return jsonify({
            "message":
                "Payment not found."
        }), 404

    return jsonify(result), 200


# ==============================
# PAYMENT STATUS
# ==============================

@mpesa_bp.route(
    "/payment/<int:payment_id>",
    methods=["GET"]
)
def get_payment_status(
    payment_id
):
    conn = None
    cur = None

    try:
        # ==============================
        # CHECK CURRENT STATUS
        # ==============================

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                payment_status
            FROM payments
            WHERE payment_id = %s;
        """, (
            payment_id,
        ))

        current_payment = (
            cur.fetchone()
        )

        if not current_payment:
            return jsonify({
                "message":
                    "Payment not found."
            }), 404

        current_status = (
            current_payment[0]
        )

        cur.close()
        conn.close()

        cur = None
        conn = None

        # ==============================
        # AUTOMATIC RECONCILIATION
        # ==============================

        if current_status == "pending":
            reconcile_payment(
                payment_id
            )

        # ==============================
        # RETURN LATEST PAYMENT
        # ==============================

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                p.payment_id,
                p.user_id,
                p.event_id,
                p.booking_id,
                p.phone_number,
                p.amount,
                p.mpesa_receipt_number,
                p.payment_status,
                p.result_code,
                p.result_description,
                p.created_at,
                p.completed_at,

                b.booking_status,

                e.event_name,

                t.ticket_id,
                t.ticket_code,
                t.ticket_status

            FROM payments p

            LEFT JOIN bookings b
                ON p.booking_id =
                   b.booking_id

            LEFT JOIN events e
                ON p.event_id =
                   e.event_id

            LEFT JOIN tickets t
                ON p.booking_id =
                   t.booking_id

            WHERE p.payment_id = %s;
        """, (
            payment_id,
        ))

        payment = cur.fetchone()

        if not payment:
            return jsonify({
                "message":
                    "Payment not found."
            }), 404

        return jsonify({
            "payment_id":
                payment[0],

            "user_id":
                payment[1],

            "event_id":
                payment[2],

            "booking_id":
                payment[3],

            "phone_number":
                payment[4],

            "amount": (
                float(payment[5])
                if payment[5]
                is not None
                else 0.0
            ),

            "mpesa_receipt_number":
                payment[6],

            "payment_status":
                payment[7],

            "result_code":
                payment[8],

            "result_description":
                payment[9],

            "created_at": (
                payment[10].isoformat()
                if payment[10]
                else None
            ),

            "completed_at": (
                payment[11].isoformat()
                if payment[11]
                else None
            ),

            "booking_status":
                payment[12],

            "event_name":
                payment[13],

            "ticket_id":
                payment[14],

            "ticket_code":
                payment[15],

            "ticket_status":
                payment[16],
        }), 200

    except Exception as error:
        return jsonify({
            "message":
                str(error)
        }), 500

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()