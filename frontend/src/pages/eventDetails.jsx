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

  const ticketRef = useRef(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/events/${eventId}`
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Could not load event.");
          return;
        }

        setEvent(data);

        // Log event detail view
        if (user?.user_id) {
          await fetch(
            "http://127.0.0.1:5000/api/interactions/log",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                user_id: user.user_id,
                event_id: eventId,
                interaction_type: "DETAIL_VIEW",
                session_id: null,
              }),
            }
          );
        }
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, user]);

  const handleBookEvent = async () => {
    if (!user?.user_id) {
      setBookingMessage("Please log in before booking.");
      return;
    }

    setBookingLoading(true);
    setBookingMessage("");
    setTicketCode("");

    try {
      // Log booking attempt
      await fetch(
        "http://127.0.0.1:5000/api/interactions/log",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.user_id,
            event_id: eventId,
            interaction_type: "BOOKING_ATTEMPT",
            session_id: null,
          }),
        }
      );

      // Create booking
      const bookingResponse = await fetch(
        "http://127.0.0.1:5000/api/bookings/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.user_id,
            event_id: eventId,
          }),
        }
      );

      const bookingData = await bookingResponse.json();

      if (!bookingResponse.ok) {
        setBookingMessage(
          bookingData.message || "Could not book this event."
        );
        return;
      }

      const bookingId = bookingData.booking_id;

      if (!bookingId) {
        setBookingMessage(
          "Booking succeeded, but no booking ID was returned."
        );
        return;
      }

      // Generate digital ticket
      const ticketResponse = await fetch(
        "http://127.0.0.1:5000/api/tickets/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            booking_id: bookingId,
          }),
        }
      );

      const ticketData = await ticketResponse.json();

      if (!ticketResponse.ok) {
        setIsBooked(true);

        setBookingMessage(
          "Booking was successful, but the ticket could not be generated."
        );

        return;
      }

      setTicketCode(ticketData.ticket_code);
      setTicketStatus(ticketData.ticket_status || "active");
      setIsBooked(true);

      setBookingMessage(
        "You're booked! Your Eventeye ticket is ready."
      );

      // Log completed booking
      await fetch(
        "http://127.0.0.1:5000/api/interactions/log",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.user_id,
            event_id: eventId,
            interaction_type: "BOOKING_COMPLETE",
            session_id: null,
          }),
        }
      );
    } catch {
      setBookingMessage("Could not connect to the server.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleDownloadTicket = async () => {
    if (!ticketRef.current || !event) return;

    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const image = canvas.toDataURL("image/png");

      const safeEventName = event.event_name
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();

      const link = document.createElement("a");

      link.href = image;
      link.download = `eventeye-${safeEventName}-ticket.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setBookingMessage("Could not download ticket.");
    }
  };

  if (loading) {
    return (
      <div className="event-details-page">
        <p>Loading event...</p>
      </div>
    );
  }

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

        <p>{message}</p>
      </div>
    );
  }

  if (!event) return null;

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

        {/* EVENT INFORMATION */}

        <div className="event-details-hero">
          <span className="event-details-category">
            {event.category_name}
          </span>

          <h1>{event.event_name}</h1>

          <p>{event.description}</p>
        </div>

        <div className="event-details-info">
          <div>
            <span>Date</span>

            <strong>
              {formatDate(event.event_date)}
            </strong>
          </div>

          <div>
            <span>Location</span>

            <strong>
              {event.location}
            </strong>
          </div>

          <div>
            <span>Organizer</span>

            <strong>
              {event.organizer_name || "Event Organizer"}
            </strong>
          </div>

          <div>
            <span>Capacity</span>

            <strong>
              {event.capacity || "Not specified"}
            </strong>
          </div>
        </div>

        {/* BOOK EVENT */}

        <button
          type="button"
          className="event-book-button"
          onClick={handleBookEvent}
          disabled={bookingLoading || isBooked}
        >
          {bookingLoading
            ? "Booking..."
            : isBooked
            ? "Booked ✓"
            : "Book Event"}
        </button>

        {bookingMessage && (
          <p className="event-booking-message">
            {bookingMessage}
          </p>
        )}

        {/* DIGITAL TICKET */}

        {ticketCode && (
          <div className="event-ticket-section">

            <div
              className="event-ticket-preview"
              ref={ticketRef}
            >

              {/* Ticket branding */}

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

              {/* Event title */}

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

              {/* Ticket details */}

              <div className="event-ticket-details">

                <div>
                  <span>Student</span>

                  <strong>
                    {user?.full_name || "Student"}
                  </strong>
                </div>

                <div>
                  <span>Date & Time</span>

                  <strong>
                    {formatDate(event.event_date)}
                  </strong>
                </div>

                <div>
                  <span>Venue</span>

                  <strong>
                    {event.location}
                  </strong>
                </div>

                <div>
                  <span>Organizer :</span>

                  <strong>
                    {event.organizer_name || "Event Organizer"}
                  </strong>
                </div>

              </div>

              {/* Perforation line */}

              <div className="event-ticket-divider">
                <span></span>
              </div>

              {/* QR */}

              <div className="event-ticket-bottom">

                <div className="event-ticket-qr">
                  <QRCodeCanvas
                    value={ticketCode}
                    size={180}
                    level="H"
                    includeMargin={true}
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
                      ticketStatus === "active"
                        ? "active"
                        : ""
                    }`}
                  >
                    ● {formatTicketStatus(ticketStatus)}
                  </span>

                </div>

              </div>

              {/* Footer */}

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
              onClick={handleDownloadTicket}
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
  if (!date) return "Not specified";

  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTicketStatus(status) {
  if (!status) return "Active";

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1).toLowerCase()
  );
}

export default EventDetails;