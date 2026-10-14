import { useEffect, useState } from "react";
import "../styles/eventDetails.css";

function EventDetails({ eventId, user, onBack }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
        <button onClick={onBack}>← Back</button>
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
            <strong>{formatDate(event.event_date)}</strong>
          </div>

          <div>
            <span>Location</span>
            <strong>{event.location}</strong>
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

        <button
          type="button"
          className="event-book-button"
        >
          Book Event
        </button>
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

export default EventDetails;