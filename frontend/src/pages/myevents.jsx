import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import "../styles/myEvents.css";

function MyEvents({ user, onBack }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadBookings = async () => {
      if (!user?.user_id) {
        setMessage("No student account found.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/bookings/user/${user.user_id}`
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(
            data.message || "Could not load your events."
          );
          return;
        }

        setBookings(data);
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [user]);

  if (loading) {
    return (
      <div className="my-events-page">
        <p>Loading your events...</p>
      </div>
    );
  }

  return (
    <div className="my-events-page">
      <button
        type="button"
        className="my-events-back"
        onClick={onBack}
      >
        ← Back
      </button>

      <div className="my-events-header">
        <div>
          <span className="my-events-eyebrow">
            YOUR EVENTEYE
          </span>

          <h1>My Events</h1>

          <p>
            Your booked events and digital tickets in one place.
          </p>
        </div>

        <div className="my-events-count">
          {bookings.length}
          <span>Booked</span>
        </div>
      </div>

      {message && (
        <p className="my-events-message">
          {message}
        </p>
      )}

      {!message && bookings.length === 0 && (
        <div className="my-events-empty">
          <h2>No events booked yet</h2>

          <p>
            When you book an event, it will appear here.
          </p>
        </div>
      )}

      <div className="my-events-grid">
        {bookings.map((booking) => (
          <MyEventCard
            key={booking.booking_id}
            booking={booking}
          />
        ))}
      </div>
    </div>
  );
}

function MyEventCard({ booking }) {
  const [ticket, setTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(true);

  useEffect(() => {
    const loadTicket = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/tickets/booking/${booking.booking_id}`
        );

        const data = await response.json();

        if (!response.ok) {
          setTicket(null);
          return;
        }

        setTicket(data);
      } catch {
        setTicket(null);
      } finally {
        setTicketLoading(false);
      }
    };

    loadTicket();
  }, [booking.booking_id]);

  return (
    <article className="my-event-card">
      <div className="my-event-card-top">
        <span className="my-event-category">
          {booking.category_name || "Campus Event"}
        </span>

        <span className="my-event-status">
          {booking.booking_status || "confirmed"}
        </span>
      </div>

      <h2>{booking.event_name}</h2>

      <p className="my-event-description">
        {booking.description}
      </p>

      <div className="my-event-meta">
        <div>
          <span>Date</span>
          <strong>
            {formatDate(booking.event_date)}
          </strong>
        </div>

        <div>
          <span>Venue</span>
          <strong>
            {booking.location}
          </strong>
        </div>
      </div>

      <div className="my-event-ticket-area">
        {ticketLoading ? (
          <p>Loading ticket...</p>
        ) : ticket ? (
          <>
            <div className="my-event-ticket-qr">
              <QRCodeCanvas
                value={ticket.ticket_code}
                size={120}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="my-event-ticket-info">
              <span>Ticket code</span>

              <strong>
                {ticket.ticket_code}
              </strong>

              <span
                className={`my-event-ticket-status ${ticket.ticket_status}`}
              >
                {ticket.ticket_status}
              </span>
            </div>
          </>
        ) : (
          <div className="my-event-ticket-placeholder">
            <span>Digital ticket</span>
            <strong>No ticket found</strong>
          </div>
        )}
      </div>
    </article>
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

export default MyEvents;