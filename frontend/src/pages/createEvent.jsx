import { useEffect, useState } from "react";
import "../styles/createEvent.css";

function CreateEvent({ user, onBack, onEventCreated }) {
  const [categories, setCategories] = useState([]);

  const [formData, setFormData] = useState({
    event_name: "",
    description: "",
    category_id: "",
    location: "",
    event_date: "",
    end_date: "",
    capacity: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdEvent, setCreatedEvent] = useState(null);

  /* =========================
     LOAD CATEGORIES
  ========================= */

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(
          "http://127.0.0.1:5000/api/preferences/categories"
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(
            data.message || "Could not load event categories."
          );
          setMessageType("error");
          return;
        }

        setCategories(data);
      } catch (error) {
        console.error("Category loading error:", error);

        setMessage(
          "Could not connect to the server to load categories."
        );
        setMessageType("error");
      }
    };

    loadCategories();
  }, []);

  /* =========================
     HANDLE FORM CHANGE
  ========================= */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (messageType === "error") {
      setMessage("");
      setMessageType("");
    }
  };

  /* =========================
     CREATE EVENT
  ========================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setMessageType("");
    setCreatedEvent(null);

    if (!user?.user_id) {
      setMessage("Organizer account not found.");
      setMessageType("error");
      return;
    }

    if (user?.user_type && user.user_type !== "organizer") {
      setMessage(
        "This account is not registered as an organizer."
      );
      setMessageType("error");
      return;
    }

    if (!formData.event_name.trim()) {
      setMessage("Please enter the event name.");
      setMessageType("error");
      return;
    }

    if (!formData.description.trim()) {
      setMessage("Please enter the event description.");
      setMessageType("error");
      return;
    }

    if (!formData.category_id) {
      setMessage("Please select an event category.");
      setMessageType("error");
      return;
    }

    if (!formData.location.trim()) {
      setMessage("Please enter the event venue.");
      setMessageType("error");
      return;
    }

    if (!formData.event_date) {
      setMessage("Please select the event start date and time.");
      setMessageType("error");
      return;
    }

    const startDate = new Date(formData.event_date);

    if (Number.isNaN(startDate.getTime())) {
      setMessage("The event start date is invalid.");
      setMessageType("error");
      return;
    }

    if (formData.end_date) {
      const endDate = new Date(formData.end_date);

      if (Number.isNaN(endDate.getTime())) {
        setMessage("The event end date is invalid.");
        setMessageType("error");
        return;
      }

      if (endDate <= startDate) {
        setMessage(
          "The event end time must be after the start time."
        );
        setMessageType("error");
        return;
      }
    }

    if (
      formData.capacity &&
      Number(formData.capacity) < 1
    ) {
      setMessage("Capacity must be at least 1.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);

    const payload = {
      event_name: formData.event_name.trim(),
      description: formData.description.trim(),
      category_id: Number(formData.category_id),
      location: formData.location.trim(),
      event_date: formData.event_date,
      end_date: formData.end_date || null,
      capacity: formData.capacity
        ? Number(formData.capacity)
        : null,
      organizer_id: Number(user.user_id),
    };

    console.log("Creating Eventeye event:", payload);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/events/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      console.log("Create event response:", data);

      if (!response.ok) {
        setMessage(
          data.message || "Could not create the event."
        );
        setMessageType("error");
        return;
      }

      setCreatedEvent({
        event_id: data.event_id,
        event_name: payload.event_name,
      });

      setMessage("Event created successfully.");
      setMessageType("success");

      setFormData({
        event_name: "",
        description: "",
        category_id: "",
        location: "",
        event_date: "",
        end_date: "",
        capacity: "",
      });
    } catch (error) {
      console.error("Create event request failed:", error);

      setMessage(
        "Could not connect to the Eventeye server."
      );
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================
     RETURN TO DASHBOARD
  ========================= */

  const handleReturnToDashboard = () => {
    if (createdEvent && onEventCreated) {
      onEventCreated(createdEvent);
      return;
    }

    onBack();
  };

  /* =========================
     CREATE ANOTHER EVENT
  ========================= */

  const handleCreateAnother = () => {
    setCreatedEvent(null);
    setMessage("");
    setMessageType("");
  };

  /* =========================
     PAGE
  ========================= */

  return (
    <div className="create-event-page">
      <button
        type="button"
        className="create-event-back"
        onClick={onBack}
      >
        ← Back to dashboard
      </button>

      <div className="create-event-shell">
        <div className="create-event-header">
          <span className="create-event-eyebrow">
            EVENTEYE ORGANIZER
          </span>

          <h1>Create Event</h1>

          <p>
            Publish an event for students to discover,
            save, book and receive digital tickets for.
          </p>
        </div>

        {!createdEvent ? (
          <form
            className="create-event-form"
            onSubmit={handleSubmit}
          >
            <div className="create-event-field full-width">
              <label htmlFor="event_name">
                Event Name *
              </label>

              <input
                id="event_name"
                name="event_name"
                type="text"
                placeholder="e.g. Campus Music Festival"
                value={formData.event_name}
                onChange={handleChange}
              />
            </div>

            <div className="create-event-field full-width">
              <label htmlFor="description">
                Description *
              </label>

              <textarea
                id="description"
                name="description"
                placeholder="Tell students what the event is about..."
                value={formData.description}
                onChange={handleChange}
                rows="5"
              />
            </div>

            <div className="create-event-form-grid">
              <div className="create-event-field">
                <label htmlFor="category_id">
                  Category *
                </label>

                <select
                  id="category_id"
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.category_id}
                      value={category.category_id}
                    >
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="create-event-field">
                <label htmlFor="location">
                  Venue / Location *
                </label>

                <input
                  id="location"
                  name="location"
                  type="text"
                  placeholder="e.g. Student Centre Grounds"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>

              <div className="create-event-field">
                <label htmlFor="event_date">
                  Start Date & Time *
                </label>

                <input
                  id="event_date"
                  name="event_date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={handleChange}
                />
              </div>

              <div className="create-event-field">
                <label htmlFor="end_date">
                  End Date & Time
                </label>

                <input
                  id="end_date"
                  name="end_date"
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={handleChange}
                />
              </div>

              <div className="create-event-field">
                <label htmlFor="capacity">
                  Capacity
                </label>

                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  placeholder="e.g. 250"
                  value={formData.capacity}
                  onChange={handleChange}
                />
              </div>

              <div className="create-event-field">
                <label>
                  Organizer
                </label>

                <div className="create-event-organizer-display">
                  {user?.full_name || "Organizer"}
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`create-event-message ${messageType}`}
              >
                {message}
              </div>
            )}

            <div className="create-event-actions">
              <button
                type="button"
                className="create-event-cancel"
                onClick={onBack}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="create-event-submit"
                disabled={submitting}
              >
                {submitting
                  ? "Creating Event..."
                  : "Publish Event"}
              </button>
            </div>
          </form>
        ) : (
          <div className="create-event-form">
            <div className="create-event-created">
              <span>EVENT CREATED</span>

              <h2>
                {createdEvent.event_name}
              </h2>

              <strong>
                Event #{createdEvent.event_id}
              </strong>

              <p>
                Your event has been published successfully
                and can now be discovered by students.
              </p>

              <div className="create-event-actions">
                <button
                  type="button"
                  className="create-event-cancel"
                  onClick={handleCreateAnother}
                >
                  Create Another
                </button>

                <button
                  type="button"
                  className="create-event-submit"
                  onClick={handleReturnToDashboard}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateEvent;