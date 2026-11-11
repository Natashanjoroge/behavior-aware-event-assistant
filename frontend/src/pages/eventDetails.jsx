import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";
import "../styles/eventDetails.css";

function EventDetails({ eventId, user, onBack }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isBooked, setIsBooked] = useState(false);

  const [ticketCode, setTicketCode] = useState("");
  const [ticketStatus, setTicketStatus] = useState("active");

  const [phoneNumber, setPhoneNumber] = useState(
    user?.phone_number || ""
  );

  const [paymentId, setPaymentId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [mpesaReceipt, setMpesaReceipt] = useState("");

  const ticketRef = useRef(null);
  const paymentPollingRef = useRef(null);

  /* =========================
     LOAD EVENT
  ========================= */

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/events/${eventId}`
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(
            data.message ||
              "Could not load event."
          );

          return;
        }

        setEvent(data);

        if (user?.user_id) {
          try {
            await fetch(
              "http://127.0.0.1:5000/api/interactions/log",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  user_id:
                    user.user_id,

                  event_id:
                    eventId,

                  interaction_type:
                    "DETAIL_VIEW",

                  session_id:
                    null,
                }),
              }
            );
          } catch (error) {
            console.error(
              "Detail interaction logging failed:",
              error
            );
          }
        }
      } catch (error) {
        console.error(
          "Event loading error:",
          error
        );

        setMessage(
          "Could not connect to the server."
        );
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, user]);

  /* =========================
     CLEAN UP PAYMENT POLLING
  ========================= */

  useEffect(() => {
    return () => {
      if (
        paymentPollingRef.current
      ) {
        clearInterval(
          paymentPollingRef.current
        );
      }
    };
  }, []);

  /* =========================
     LOG BOOKING INTERACTION
  ========================= */

  const logBookingInteraction = async (
    interactionType
  ) => {
    if (!user?.user_id) return;

    try {
      await fetch(
        "http://127.0.0.1:5000/api/interactions/log",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id:
              user.user_id,

            event_id:
              eventId,

            interaction_type:
              interactionType,

            session_id:
              null,
          }),
        }
      );
    } catch (error) {
      console.error(
        "Interaction logging failed:",
        error
      );
    }
  };

  /* =========================
     LOAD TICKET
  ========================= */

  const loadTicket = async (
    bookingId
  ) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/tickets/booking/${bookingId}`
      );

      const data = await response.json();

      if (!response.ok) {
        return false;
      }

      if (!data.ticket_code) {
        return false;
      }

      setTicketCode(
        data.ticket_code
      );

      setTicketStatus(
        data.ticket_status ||
          "active"
      );

      return true;
    } catch (error) {
      console.error(
        "Ticket loading error:",
        error
      );

      return false;
    }
  };

  /* =========================
     GENERATE TICKET
  ========================= */

  const generateTicket = async (
    bookingId
  ) => {
    try {
      const ticketResponse =
        await fetch(
          "http://127.0.0.1:5000/api/tickets/generate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              booking_id:
                bookingId,
            }),
          }
        );

      const ticketData =
        await ticketResponse.json();

      if (!ticketResponse.ok) {
        return false;
      }

      setTicketCode(
        ticketData.ticket_code
      );

      setTicketStatus(
        ticketData.ticket_status ||
          "active"
      );

      return true;
    } catch (error) {
      console.error(
        "Ticket generation error:",
        error
      );

      return false;
    }
  };

  /* =========================
     COMPLETE BOOKING
  ========================= */

  const completeBooking = async (
    bookingId,
    paid = false
  ) => {
    let ticketLoaded =
      await loadTicket(
        bookingId
      );

    if (!ticketLoaded) {
      ticketLoaded =
        await generateTicket(
          bookingId
        );
    }

    setIsBooked(true);

    if (ticketLoaded) {
      setBookingMessage(
        paid
          ? "Payment successful! Your Eventeye ticket is ready."
          : "You're booked! Your Eventeye ticket is ready."
      );
    } else {
      setBookingMessage(
        paid
          ? "Payment was successful, but your ticket could not be loaded."
          : "Booking was successful, but the ticket could not be generated."
      );
    }

    await logBookingInteraction(
      "BOOKING_COMPLETE"
    );
  };

  /* =========================
     FREE EVENT BOOKING
  ========================= */

  const handleFreeBooking = async () => {
    setBookingLoading(true);
    setBookingMessage("");
    setTicketCode("");

    try {
      await logBookingInteraction(
        "BOOKING_ATTEMPT"
      );

      const bookingResponse =
        await fetch(
          "http://127.0.0.1:5000/api/bookings/",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              user_id:
                user.user_id,

              event_id:
                eventId,
            }),
          }
        );

      const bookingData =
        await bookingResponse.json();

      if (!bookingResponse.ok) {
        setBookingMessage(
          bookingData.message ||
            "Could not book this event."
        );

        return;
      }

      const bookingId =
        bookingData.booking_id;

      if (!bookingId) {
        setBookingMessage(
          "Booking succeeded, but no booking ID was returned."
        );

        return;
      }

      await completeBooking(
        bookingId,
        false
      );
    } catch (error) {
      console.error(
        "Free booking error:",
        error
      );

      setBookingMessage(
        "Could not connect to the server."
      );
    } finally {
      setBookingLoading(false);
    }
  };

  /* =========================
     PHONE VALIDATION
  ========================= */

  const isValidKenyanPhone = (
    value
  ) => {
    const cleaned = value
      .replace(/\s+/g, "")
      .replace(/-/g, "");

    return (
      /^0[17]\d{8}$/.test(
        cleaned
      ) ||
      /^254[17]\d{8}$/.test(
        cleaned
      ) ||
      /^\+254[17]\d{8}$/.test(
        cleaned
      )
    );
  };

  /* =========================
     CHECK PAYMENT STATUS
  ========================= */

  const checkPaymentStatus = async (
    currentPaymentId
  ) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/mpesa/payment/${currentPaymentId}`
      );

      const data = await response.json();

      if (!response.ok) {
        return;
      }

      setPaymentStatus(
        data.payment_status ||
          ""
      );

      if (
        data.payment_status ===
        "completed"
      ) {
        if (
          paymentPollingRef.current
        ) {
          clearInterval(
            paymentPollingRef.current
          );

          paymentPollingRef.current =
            null;
        }

        setBookingLoading(false);

        if (
          data.mpesa_receipt_number
        ) {
          setMpesaReceipt(
            data.mpesa_receipt_number
          );
        }

        await completeBooking(
          data.booking_id,
          true
        );
      }

      if (
        data.payment_status ===
        "failed"
      ) {
        if (
          paymentPollingRef.current
        ) {
          clearInterval(
            paymentPollingRef.current
          );

          paymentPollingRef.current =
            null;
        }

        setBookingLoading(false);

        setBookingMessage(
          data.result_description ||
            "M-Pesa payment was not completed. Please try again."
        );
      }
    } catch (error) {
      console.error(
        "Payment status error:",
        error
      );
    }
  };

  /* =========================
     START PAYMENT POLLING
  ========================= */

  const startPaymentPolling = (
    currentPaymentId
  ) => {
    if (
      paymentPollingRef.current
    ) {
      clearInterval(
        paymentPollingRef.current
      );
    }

    let attempts = 0;

    paymentPollingRef.current =
      setInterval(async () => {
        attempts += 1;

        await checkPaymentStatus(
          currentPaymentId
        );

        if (attempts >= 18) {
          clearInterval(
            paymentPollingRef.current
          );

          paymentPollingRef.current =
            null;

          setBookingLoading(false);

          setBookingMessage(
            "Payment is still pending. If you completed the M-Pesa prompt, your booking will be confirmed once payment is received."
          );
        }
      }, 10000);
  };

  /* =========================
     M-PESA BOOKING
  ========================= */

  const handleMpesaBooking = async () => {
    if (!phoneNumber.trim()) {
      setBookingMessage(
        "Enter the M-Pesa phone number you want to use."
      );

      return;
    }

    if (
      !isValidKenyanPhone(
        phoneNumber
      )
    ) {
      setBookingMessage(
        "Enter a valid Kenyan M-Pesa number, for example 0712345678."
      );

      return;
    }

    setBookingLoading(true);
    setBookingMessage("");
    setTicketCode("");
    setPaymentStatus("");
    setPaymentId(null);
    setMpesaReceipt("");

    try {
      await logBookingInteraction(
        "BOOKING_ATTEMPT"
      );

      const response = await fetch(
        "http://127.0.0.1:5000/api/mpesa/stk-push",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id:
              user.user_id,

            event_id:
              eventId,

            phone_number:
              phoneNumber.trim(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setBookingMessage(
          data.message ||
            "Could not start M-Pesa payment."
        );

        setBookingLoading(false);
        return;
      }

      if (!data.payment_id) {
        setBookingMessage(
          "M-Pesa request was sent, but no payment ID was returned."
        );

        setBookingLoading(false);
        return;
      }

      setPaymentId(
        data.payment_id
      );

      setPaymentStatus(
        "pending"
      );

      setBookingMessage(
        "M-Pesa prompt sent. Check your phone and enter your PIN to complete payment."
      );

      startPaymentPolling(
        data.payment_id
      );
    } catch (error) {
      console.error(
        "M-Pesa booking error:",
        error
      );

      setBookingMessage(
        "Could not connect to the M-Pesa payment service."
      );

      setBookingLoading(false);
    }
  };

  /* =========================
     MAIN BOOK BUTTON
  ========================= */

  const handleBookEvent = async () => {
    if (!user?.user_id) {
      setBookingMessage(
        "Please log in before booking."
      );

      return;
    }

    if (event?.is_paid) {
      await handleMpesaBooking();
      return;
    }

    await handleFreeBooking();
  };

  /* =========================
     DOWNLOAD TICKET
  ========================= */

  const handleDownloadTicket = async () => {
    if (
      !ticketRef.current ||
      !event
    ) {
      return;
    }

    try {
      const canvas =
        await html2canvas(
          ticketRef.current,
          {
            scale: 3,
            backgroundColor:
              "#ffffff",
            useCORS: true,
          }
        );

      const image =
        canvas.toDataURL(
          "image/png"
        );

      const safeEventName =
        event.event_name
          .replace(
            /[^a-z0-9]/gi,
            "-"
          )
          .toLowerCase();

      const link =
        document.createElement(
          "a"
        );

      link.href = image;

      link.download =
        `eventeye-${safeEventName}-ticket.png`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );
    } catch (error) {
      console.error(
        "Ticket download error:",
        error
      );

      setBookingMessage(
        "Could not download ticket."
      );
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="event-details-page">
        <p>
          Loading event...
        </p>
      </div>
    );
  }

  /* =========================
     ERROR
  ========================= */

  if (message) {
    return (
      <div className="event-details-page">

        <button
          type="button"
          className="event-back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <p>
          {message}
        </p>

      </div>
    );
  }

  if (!event) {
    return null;
  }

  /* =========================
     PAGE
  ========================= */

  return (
    <div className="event-details-page">

      <button
        type="button"
        className="event-back-button"
        onClick={onBack}
      >
        ← Back to events
      </button>

      <div className="event-details-card">

        <div className="event-details-hero">

          <span className="event-details-category">
            {event.category_name}
          </span>

          <h1>
            {event.event_name}
          </h1>

          <p>
            {event.description}
          </p>

          <div
            style={{
              marginTop: "16px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "999px",
              background:
                event.is_paid
                  ? "#f3f0ff"
                  : "#ecfdf5",
              color:
                event.is_paid
                  ? "#6256d9"
                  : "#047857",
              fontWeight: "700",
              fontSize: "13px",
            }}
          >
            {event.is_paid
              ? `Paid Event • KES ${Number(
                  event.ticket_price ||
                    0
                ).toLocaleString()}`
              : "Free Event"}
          </div>

        </div>

        <div className="event-details-info">

          <div>
            <span>
              Date
            </span>

            <strong>
              {formatDate(
                event.event_date
              )}
            </strong>
          </div>

          <div>
            <span>
              Location
            </span>

            <strong>
              {event.location}
            </strong>
          </div>

          <div>
            <span>
              Organizer
            </span>

            <strong>
              {event.organizer_name ||
                "Event Organizer"}
            </strong>
          </div>

          <div>
            <span>
              Capacity
            </span>

            <strong>
              {event.capacity ||
                "Not specified"}
            </strong>
          </div>

        </div>

        {event.is_paid &&
          !isBooked && (
            <div
              style={{
                marginTop: "24px",
                padding: "20px",
                borderRadius: "18px",
                background: "#f8f7fc",
                border:
                  "1px solid #e8e5f0",
              }}
            >
              <div
                style={{
                  marginBottom: "14px",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "16px",
                    marginBottom: "4px",
                  }}
                >
                  Pay with M-Pesa
                </strong>

                <span
                  style={{
                    color: "#817a89",
                    fontSize: "13px",
                  }}
                >
                  Ticket price: KES{" "}
                  {Number(
                    event.ticket_price ||
                      0
                  ).toLocaleString()}
                </span>
              </div>

              <label
                htmlFor="mpesa-phone-number"
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                M-Pesa Phone Number
              </label>

              <input
                id="mpesa-phone-number"
                type="tel"
                placeholder="e.g. 0712345678"
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(
                    e.target.value
                  )
                }
                disabled={
                  bookingLoading
                }
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  padding:
                    "13px 14px",
                  borderRadius: "12px",
                  border:
                    "1px solid #ddd9e7",
                  outline: "none",
                  fontSize: "14px",
                  background:
                    "#ffffff",
                  marginBottom:
                    "12px",
                }}
              />

              <small
                style={{
                  display: "block",
                  color: "#817a89",
                  marginBottom: "5px",
                }}
              >
                An M-Pesa payment prompt will be
                sent to this number.
              </small>
            </div>
          )}

        <button
          type="button"
          className="event-book-button"
          onClick={
            handleBookEvent
          }
          disabled={
            bookingLoading ||
            isBooked
          }
        >
          {bookingLoading
            ? event.is_paid
              ? "Waiting for M-Pesa..."
              : "Booking..."
            : isBooked
            ? "Booked ✓"
            : event.is_paid
            ? `Pay KES ${Number(
                event.ticket_price ||
                  0
              ).toLocaleString()} with M-Pesa`
            : "Book Event"}
        </button>

        {paymentStatus && (
          <div
            style={{
              marginTop: "14px",
              padding:
                "12px 14px",
              borderRadius:
                "12px",
              background:
                paymentStatus ===
                "completed"
                  ? "#ecfdf5"
                  : paymentStatus ===
                    "failed"
                  ? "#fef2f2"
                  : "#fff8e7",
              fontSize: "13px",
            }}
          >
            <strong>
              Payment Status:{" "}
              {formatPaymentStatus(
                paymentStatus
              )}
            </strong>

            {paymentId && (
              <div
                style={{
                  marginTop: "4px",
                  color: "#817a89",
                }}
              >
                Payment #
                {paymentId}
              </div>
            )}

            {mpesaReceipt && (
              <div
                style={{
                  marginTop: "4px",
                  color: "#047857",
                  fontWeight: "600",
                }}
              >
                M-Pesa Receipt:{" "}
                {mpesaReceipt}
              </div>
            )}
          </div>
        )}

        {bookingMessage && (
          <p className="event-booking-message">
            {bookingMessage}
          </p>
        )}

        {ticketCode && (
          <div className="event-ticket-section">

            <div
              className="event-ticket-preview"
              ref={ticketRef}
            >

              <div className="event-ticket-brand">

                <div>
                  <span className="event-ticket-brand-name">
                    Eventeye
                  </span>

                  <span className="event-ticket-brand-subtitle">
                    Digital Admission Ticket
                  </span>
                </div>

                <span className="event-ticket-admit">
                  ADMIT ONE
                </span>

              </div>

              <div className="event-ticket-event">

                <span className="event-ticket-category">
                  {event.category_name}
                </span>

                <h2>
                  {event.event_name}
                </h2>

                <p>
                  {event.description}
                </p>

              </div>

              <div className="event-ticket-details">

                <div>
                  <span>
                    Student
                  </span>

                  <strong>
                    {user?.full_name ||
                      "Student"}
                  </strong>
                </div>

                <div>
                  <span>
                    Date & Time
                  </span>

                  <strong>
                    {formatDate(
                      event.event_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Venue
                  </span>

                  <strong>
                    {event.location}
                  </strong>
                </div>

                <div>
                  <span>
                    Organizer
                  </span>

                  <strong>
                    {event.organizer_name ||
                      "Event Organizer"}
                  </strong>
                </div>

                <div>
                  <span>
                    Admission
                  </span>

                  <strong>
                    {event.is_paid
                      ? `KES ${Number(
                          event.ticket_price ||
                            0
                        ).toLocaleString()}`
                      : "FREE"}
                  </strong>
                </div>

                {mpesaReceipt && (
                  <div>
                    <span>
                      M-Pesa Receipt
                    </span>

                    <strong>
                      {mpesaReceipt}
                    </strong>
                  </div>
                )}

              </div>

              <div className="event-ticket-divider">
                <span></span>
              </div>

              <div className="event-ticket-bottom">

                <div className="event-ticket-qr">

                  <QRCodeCanvas
                    value={
                      ticketCode
                    }
                    size={180}
                    level="H"
                    includeMargin={
                      true
                    }
                  />

                </div>

                <div className="event-ticket-code-area">

                  <span className="event-ticket-code-label">
                    TICKET CODE :
                  </span>

                  <strong className="event-ticket-code">
                    {ticketCode}
                  </strong>

                  <span className="event-ticket-checkin">
                    Present this QR code at the event entrance.
                  </span>

                  <span
                    className={`event-ticket-status ${
                      ticketStatus ===
                      "active"
                        ? "active"
                        : ""
                    }`}
                  >
                    ●{" "}
                    {formatTicketStatus(
                      ticketStatus
                    )}
                  </span>

                </div>

              </div>

              <div className="event-ticket-footer">

                <span>
                  Eventeye
                </span>

                <span>
                  Your campus. Your events.
                </span>

              </div>

            </div>

            <button
              type="button"
              className="event-ticket-download-button"
              onClick={
                handleDownloadTicket
              }
            >
              ↓ Download Ticket
            </button>

          </div>
        )}

      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) {
    return "Not specified";
  }

  return new Date(
    date
  ).toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatTicketStatus(
  status
) {
  if (!status) {
    return "Active";
  }

  return (
    status
      .charAt(0)
      .toUpperCase() +
    status
      .slice(1)
      .toLowerCase()
  );
}

function formatPaymentStatus(
  status
) {
  if (!status) {
    return "";
  }

  if (
    status === "completed"
  ) {
    return "Paid ✓";
  }

  if (
    status === "failed"
  ) {
    return "Failed";
  }

  if (
    status === "pending"
  ) {
    return "Waiting for payment";
  }

  return (
    status
      .charAt(0)
      .toUpperCase() +
    status
      .slice(1)
      .toLowerCase()
  );
}

export default EventDetails;