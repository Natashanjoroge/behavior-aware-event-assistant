import { useEffect, useMemo, useState } from "react";
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
    is_paid: false,
    ticket_price: "",
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdEvent, setCreatedEvent] = useState(null);

  /* =========================
     TODAY - LOCAL DATE
  ========================= */

  const minimumEventDateTime = useMemo(() => {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}T00:00`;
  }, []);

  const todayDateString = useMemo(() => {
    return minimumEventDateTime.split("T")[0];
  }, [minimumEventDateTime]);

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
            data.message ||
              "Could not load event categories."
          );

          setMessageType("error");
          return;
        }

        setCategories(data);
      } catch (error) {
        console.error(
          "Category loading error:",
          error
        );

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
    const { name, value, type, checked } =
      event.target;

    setFormData((current) => {
      const updated = {
        ...current,
        [name]:
          type === "checkbox"
            ? checked
            : value,
      };

      if (
        name === "event_date" &&
        current.end_date
      ) {
        const newStart = new Date(value);

        const existingEnd =
          new Date(current.end_date);

        if (
          !Number.isNaN(
            newStart.getTime()
          ) &&
          !Number.isNaN(
            existingEnd.getTime()
          ) &&
          existingEnd <= newStart
        ) {
          updated.end_date = "";
        }
      }

      if (
        name === "is_paid" &&
        checked === false
      ) {
        updated.ticket_price = "";
      }

      return updated;
    });

    if (messageType === "error") {
      setMessage("");
      setMessageType("");
    }
  };

  /* =========================
     SET EVENT TYPE
  ========================= */

  const handleEventType = (paid) => {
    setFormData((current) => ({
      ...current,
      is_paid: paid,
      ticket_price:
        paid
          ? current.ticket_price
          : "",
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
      setMessage(
        "Organizer account not found."
      );

      setMessageType("error");
      return;
    }

    if (
      user?.user_type &&
      user.user_type !== "organizer"
    ) {
      setMessage(
        "This account is not registered as an organizer."
      );

      setMessageType("error");
      return;
    }

    if (
      !formData.event_name.trim()
    ) {
      setMessage(
        "Please enter the event name."
      );

      setMessageType("error");
      return;
    }

    if (
      !formData.description.trim()
    ) {
      setMessage(
        "Please enter the event description."
      );

      setMessageType("error");
      return;
    }

    if (!formData.category_id) {
      setMessage(
        "Please select an event category."
      );

      setMessageType("error");
      return;
    }

    if (!formData.location.trim()) {
      setMessage(
        "Please enter the event venue."
      );

      setMessageType("error");
      return;
    }

    if (!formData.event_date) {
      setMessage(
        "Please select the event start date and time."
      );

      setMessageType("error");
      return;
    }

    const startDate =
      new Date(formData.event_date);

    if (
      Number.isNaN(
        startDate.getTime()
      )
    ) {
      setMessage(
        "The event start date is invalid."
      );

      setMessageType("error");
      return;
    }

    const selectedStartDate =
      formData.event_date.split("T")[0];

    if (
      selectedStartDate <
      todayDateString
    ) {
      setMessage(
        "The event date cannot be before today's date."
      );

      setMessageType("error");
      return;
    }

    if (formData.end_date) {
      const endDate =
        new Date(formData.end_date);

      if (
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        setMessage(
          "The event end date is invalid."
        );

        setMessageType("error");
        return;
      }

      const selectedEndDate =
        formData.end_date.split("T")[0];

      if (
        selectedEndDate <
        todayDateString
      ) {
        setMessage(
          "The event end date cannot be before today's date."
        );

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
      setMessage(
        "Capacity must be at least 1."
      );

      setMessageType("error");
      return;
    }

    if (formData.is_paid) {
      if (!formData.ticket_price) {
        setMessage(
          "Please enter the ticket price."
        );

        setMessageType("error");
        return;
      }

      if (
        Number(formData.ticket_price) <= 0
      ) {
        setMessage(
          "Ticket price must be greater than KES 0."
        );

        setMessageType("error");
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      event_name:
        formData.event_name.trim(),

      description:
        formData.description.trim(),

      category_id:
        Number(
          formData.category_id
        ),

      location:
        formData.location.trim(),

      event_date:
        formData.event_date,

      end_date:
        formData.end_date || null,

      capacity:
        formData.capacity
          ? Number(
              formData.capacity
            )
          : null,

      organizer_id:
        Number(user.user_id),

      is_paid:
        formData.is_paid,

      ticket_price:
        formData.is_paid
          ? Number(
              formData.ticket_price
            )
          : 0,
    };

    console.log(
      "Creating Eventeye event:",
      payload
    );

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/events/",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(payload),
        }
      );

      const data =
        await response.json();

      console.log(
        "Create event response:",
        data
      );

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not create the event."
        );

        setMessageType("error");
        return;
      }

      setCreatedEvent({
        event_id:
          data.event_id,

        event_name:
          payload.event_name,

        is_paid:
          payload.is_paid,

        ticket_price:
          payload.ticket_price,
      });

      setMessage(
        "Event created successfully."
      );

      setMessageType("success");

      setFormData({
        event_name: "",
        description: "",
        category_id: "",
        location: "",
        event_date: "",
        end_date: "",
        capacity: "",
        is_paid: false,
        ticket_price: "",
      });
    } catch (error) {
      console.error(
        "Create event request failed:",
        error
      );

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
    if (
      createdEvent &&
      onEventCreated
    ) {
      onEventCreated(
        createdEvent
      );

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

          <h1>
            Create Event
          </h1>

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
                value={
                  formData.event_name
                }
                onChange={
                  handleChange
                }
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
                value={
                  formData.description
                }
                onChange={
                  handleChange
                }
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
                  value={
                    formData.category_id
                  }
                  onChange={
                    handleChange
                  }
                >

                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={
                          category.category_id
                        }
                        value={
                          category.category_id
                        }
                      >
                        {
                          category.category_name
                        }
                      </option>
                    )
                  )}

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
                  value={
                    formData.location
                  }
                  onChange={
                    handleChange
                  }
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
                  min={
                    minimumEventDateTime
                  }
                  value={
                    formData.event_date
                  }
                  onChange={
                    handleChange
                  }
                />

                <small
                  style={{
                    color: "#817a89",
                    marginTop: "6px",
                    display: "block",
                    fontSize: "12px",
                  }}
                >
                  Events cannot be dated before today.
                </small>

              </div>

              <div className="create-event-field">

                <label htmlFor="end_date">
                  End Date & Time
                </label>

                <input
                  id="end_date"
                  name="end_date"
                  type="datetime-local"
                  min={
                    formData.event_date ||
                    minimumEventDateTime
                  }
                  value={
                    formData.end_date
                  }
                  onChange={
                    handleChange
                  }
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
                  value={
                    formData.capacity
                  }
                  onChange={
                    handleChange
                  }
                />

              </div>

              <div className="create-event-field">

                <label>
                  Organizer
                </label>

                <div className="create-event-organizer-display">
                  {user?.full_name ||
                    "Organizer"}
                </div>

              </div>

            </div>

            <div
              className="create-event-field full-width"
              style={{
                marginTop: "8px",
              }}
            >
              <label>
                Event Access *
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleEventType(false)
                  }
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    border:
                      !formData.is_paid
                        ? "2px solid #6c63ff"
                        : "1px solid #dedbe5",
                    background:
                      !formData.is_paid
                        ? "#f4f2ff"
                        : "#ffffff",
                    textAlign: "left",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "5px",
                    }}
                  >
                    Free Event
                  </strong>

                  <span
                    style={{
                      fontSize: "13px",
                      color: "#817a89",
                    }}
                  >
                    Students can book without payment.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleEventType(true)
                  }
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    border:
                      formData.is_paid
                        ? "2px solid #6c63ff"
                        : "1px solid #dedbe5",
                    background:
                      formData.is_paid
                        ? "#f4f2ff"
                        : "#ffffff",
                    textAlign: "left",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "5px",
                    }}
                  >
                    Paid Event
                  </strong>

                  <span
                    style={{
                      fontSize: "13px",
                      color: "#817a89",
                    }}
                  >
                    Students pay using M-Pesa before receiving a ticket.
                  </span>
                </button>
              </div>
            </div>

            {formData.is_paid && (
              <div
                className="create-event-field full-width"
              >
                <label htmlFor="ticket_price">
                  Ticket Price (KES) *
                </label>

                <input
                  id="ticket_price"
                  name="ticket_price"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 500"
                  value={
                    formData.ticket_price
                  }
                  onChange={
                    handleChange
                  }
                />

                <small
                  style={{
                    color: "#817a89",
                    marginTop: "6px",
                    display: "block",
                    fontSize: "12px",
                  }}
                >
                  Students will be prompted to pay this amount through M-Pesa.
                </small>
              </div>
            )}

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
                disabled={
                  submitting
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="create-event-submit"
                disabled={
                  submitting
                }
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

              <span>
                EVENT CREATED
              </span>

              <h2>
                {
                  createdEvent.event_name
                }
              </h2>

              <strong>
                Event #
                {
                  createdEvent.event_id
                }
              </strong>

              <p>
                Your event has been published successfully
                and can now be discovered by students.
              </p>

              <div
                style={{
                  marginTop: "14px",
                  padding: "14px 18px",
                  borderRadius: "14px",
                  background: "#f7f6fb",
                  display: "inline-block",
                }}
              >
                <strong>
                  {createdEvent.is_paid
                    ? `Paid Event • KES ${Number(
                        createdEvent.ticket_price
                      ).toLocaleString()}`
                    : "Free Event"}
                </strong>
              </div>

              <div className="create-event-actions">

                <button
                  type="button"
                  className="create-event-cancel"
                  onClick={
                    handleCreateAnother
                  }
                >
                  Create Another
                </button>

                <button
                  type="button"
                  className="create-event-submit"
                  onClick={
                    handleReturnToDashboard
                  }
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