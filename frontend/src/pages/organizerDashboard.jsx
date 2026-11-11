import { useEffect, useMemo, useState } from "react";
import Logo from "../components/logo";
import CreateEvent from "./createEvent";
import OrganizerAnalytics from "./organizerAnalytics";
import OrganizerProfile from "./organizerProfile";
import "../styles/organizerDashboard.css";

function OrganizerDashboard({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");

  const [manageSearch, setManageSearch] = useState("");
  const [manageFilter, setManageFilter] = useState("all");

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const [actionMessage, setActionMessage] = useState("");
  const [actionType, setActionType] = useState("");

  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingEventId, setCancellingEventId] = useState(null);

  const [checkInEventId, setCheckInEventId] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [verifiedTicket, setVerifiedTicket] = useState(null);

  const [checkInMessage, setCheckInMessage] = useState("");
  const [checkInMessageType, setCheckInMessageType] = useState("");

  const [verifyingTicket, setVerifyingTicket] = useState(false);
  const [checkingInTicket, setCheckingInTicket] = useState(false);

  const [checkInList, setCheckInList] = useState([]);

  const [checkInSummary, setCheckInSummary] = useState({
    total_booked: 0,
    total_checked_in: 0,
    remaining: 0,
  });

  const [loadingCheckIns, setLoadingCheckIns] = useState(false);

  const todayDateTime = useMemo(() => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}T00:00`;
  }, []);

  const todayDate = todayDateTime.split("T")[0];

  const loadEvents = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/events/organizer/${user.user_id}`
      );

      const data = await response.json();

      if (response.ok) {
        setEvents(data);
      } else {
        console.error("Could not load organizer events:", data);
      }
    } catch (error) {
      console.error("Could not connect to organizer events API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user]);

  const loadEventCheckIns = async () => {
    if (!checkInEventId || !user?.user_id) {
      setCheckInList([]);

      setCheckInSummary({
        total_booked: 0,
        total_checked_in: 0,
        remaining: 0,
      });

      return;
    }

    setLoadingCheckIns(true);

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/tickets/event/${checkInEventId}/check-ins?organizer_id=${user.user_id}`
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Could not load check-ins:", data);

        setCheckInList([]);

        setCheckInSummary({
          total_booked: 0,
          total_checked_in: 0,
          remaining: 0,
        });

        return;
      }

      setCheckInList(data.attendees || []);

      setCheckInSummary(
        data.summary || {
          total_booked: 0,
          total_checked_in: 0,
          remaining: 0,
        }
      );
    } catch (error) {
      console.error("Check-in list loading error:", error);
    } finally {
      setLoadingCheckIns(false);
    }
  };

  useEffect(() => {
    if (activeView === "check-in" && checkInEventId) {
      loadEventCheckIns();
    }
  }, [activeView, checkInEventId, user]);

  const managedEvents = useMemo(() => {
    const query = manageSearch.trim().toLowerCase();

    return events.filter((event) => {
      const eventDate = event.event_date
        ? new Date(event.event_date)
        : null;

      let matchesFilter = true;

      if (manageFilter === "upcoming") {
        matchesFilter =
          eventDate &&
          eventDate >= new Date() &&
          event.status !== "cancelled";
      }

      if (manageFilter === "past") {
        matchesFilter =
          eventDate &&
          eventDate < new Date() &&
          event.status !== "cancelled";
      }

      if (manageFilter === "cancelled") {
        matchesFilter = event.status === "cancelled";
      }

      const matchesSearch =
        !query ||
        event.event_name?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.category_name?.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [events, manageSearch, manageFilter]);

  if (activeView === "create-event") {
    return (
      <CreateEvent
        user={user}
        onBack={() => setActiveView("dashboard")}
        onEventCreated={() => {
          loadEvents();
          setActiveView("dashboard");
        }}
      />
    );
  }

  const now = new Date();

  const allUpcomingEvents = events.filter(
    (event) =>
      event.event_date &&
      new Date(event.event_date) >= now &&
      event.status !== "cancelled"
  );

  const upcomingEvents = [...allUpcomingEvents]
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 4);

  const pastEvents = events.filter(
    (event) =>
      event.event_date &&
      new Date(event.event_date) < now &&
      event.status !== "cancelled"
  );

  const cancelledEvents = events.filter(
    (event) => event.status === "cancelled"
  );

  const totalEvents = events.length;

  const handleViewEvent = (event) => {
    setSelectedEvent(event);
    setEditingEvent(null);
    setActionMessage("");
  };

  const handleStartEdit = (event) => {
    setSelectedEvent(null);

    setEditingEvent({
      ...event,
      event_date: toDateTimeLocal(event.event_date),
      end_date: toDateTimeLocal(event.end_date),
      capacity: event.capacity || "",
    });

    setActionMessage("");
    setActionType("");
  };

  const handleEditChange = (changeEvent) => {
    const { name, value } = changeEvent.target;

    setEditingEvent((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveEdit = async (submitEvent) => {
    submitEvent.preventDefault();

    if (!editingEvent) {
      return;
    }

    setActionMessage("");
    setActionType("");

    if (!editingEvent.event_name?.trim()) {
      setActionMessage("Event name is required.");
      setActionType("error");
      return;
    }

    if (!editingEvent.description?.trim()) {
      setActionMessage("Description is required.");
      setActionType("error");
      return;
    }

    if (!editingEvent.location?.trim()) {
      setActionMessage("Location is required.");
      setActionType("error");
      return;
    }

    if (!editingEvent.event_date) {
      setActionMessage("Event start date is required.");
      setActionType("error");
      return;
    }

    const startDateString = editingEvent.event_date.split("T")[0];

    if (startDateString < todayDate) {
      setActionMessage("The event date cannot be before today's date.");
      setActionType("error");
      return;
    }

    const startDate = new Date(editingEvent.event_date);

    if (Number.isNaN(startDate.getTime())) {
      setActionMessage("The event start date is invalid.");
      setActionType("error");
      return;
    }

    if (editingEvent.end_date) {
      const endDate = new Date(editingEvent.end_date);

      if (Number.isNaN(endDate.getTime())) {
        setActionMessage("The event end date is invalid.");
        setActionType("error");
        return;
      }

      if (endDate <= startDate) {
        setActionMessage(
          "The event end time must be after the start time."
        );
        setActionType("error");
        return;
      }
    }

    if (editingEvent.capacity && Number(editingEvent.capacity) < 1) {
      setActionMessage("Capacity must be at least 1.");
      setActionType("error");
      return;
    }

    setSavingEdit(true);

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/events/${editingEvent.event_id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            organizer_id: Number(user.user_id),
            event_name: editingEvent.event_name.trim(),
            description: editingEvent.description.trim(),
            location: editingEvent.location.trim(),
            event_date: editingEvent.event_date,
            end_date: editingEvent.end_date || null,
            capacity: editingEvent.capacity
              ? Number(editingEvent.capacity)
              : null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message || "Could not update the event.");
        setActionType("error");
        return;
      }

      setActionMessage("Event updated successfully.");
      setActionType("success");
      setEditingEvent(null);

      await loadEvents();
    } catch (error) {
      console.error("Update event request failed:", error);

      setActionMessage("Could not connect to the Eventeye server.");
      setActionType("error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEvent = async (event) => {
    const confirmed = window.confirm(
      `Cancel "${event.event_name}"? Students will no longer be able to book this event.`
    );

    if (!confirmed) {
      return;
    }

    setCancellingEventId(event.event_id);
    setActionMessage("");
    setActionType("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/events/${event.event_id}/cancel`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            organizer_id: Number(user.user_id),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.message || "Could not cancel the event.");
        setActionType("error");
        return;
      }

      setActionMessage("Event cancelled successfully.");
      setActionType("success");

      setSelectedEvent(null);
      setEditingEvent(null);

      await loadEvents();
    } catch (error) {
      console.error("Cancel event request failed:", error);

      setActionMessage("Could not connect to the Eventeye server.");
      setActionType("error");
    } finally {
      setCancellingEventId(null);
    }
  };

  const handleCheckInEventChange = (event) => {
    setCheckInEventId(event.target.value);
    setTicketCode("");
    setVerifiedTicket(null);
    setCheckInMessage("");
    setCheckInMessageType("");
  };

  const handleVerifyTicket = async (event) => {
    event.preventDefault();

    const cleanedTicket = ticketCode.trim().toUpperCase();

    setVerifiedTicket(null);
    setCheckInMessage("");
    setCheckInMessageType("");

    if (!checkInEventId) {
      setCheckInMessage("Please select an event first.");
      setCheckInMessageType("error");
      return;
    }

    if (!cleanedTicket) {
      setCheckInMessage("Please enter a ticket code.");
      setCheckInMessageType("error");
      return;
    }

    setVerifyingTicket(true);

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/tickets/verify/${encodeURIComponent(
          cleanedTicket
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        setCheckInMessage(
          data.message || "Ticket could not be verified."
        );
        setCheckInMessageType("error");
        return;
      }

      if (Number(data.event?.event_id) !== Number(checkInEventId)) {
        setCheckInMessage(
          `This ticket belongs to "${data.event?.event_name}", not the selected event.`
        );
        setCheckInMessageType("error");
        return;
      }

      setVerifiedTicket(data);

      if (data.valid) {
        setCheckInMessage("Ticket verified successfully.");
        setCheckInMessageType("success");
      } else {
        setCheckInMessage(
          data.message || "This ticket cannot be checked in."
        );
        setCheckInMessageType("error");
      }
    } catch (error) {
      console.error("Ticket verification failed:", error);

      setCheckInMessage("Could not connect to the Eventeye server.");
      setCheckInMessageType("error");
    } finally {
      setVerifyingTicket(false);
    }
  };

  const handleCheckInTicket = async () => {
    if (
      !verifiedTicket?.valid ||
      !verifiedTicket?.ticket?.ticket_code
    ) {
      return;
    }

    setCheckingInTicket(true);
    setCheckInMessage("");
    setCheckInMessageType("");

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/tickets/check-in",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            ticket_code: verifiedTicket.ticket.ticket_code,
            organizer_id: Number(user.user_id),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setCheckInMessage(
          data.message || "Could not check in this ticket."
        );
        setCheckInMessageType("error");
        return;
      }

      setVerifiedTicket({
        valid: false,
        ticket: data.ticket,
        booking: data.booking,
        student: data.student,
        event: data.event,
        message: "Student checked in successfully.",
      });

      setCheckInMessage(
        `${data.student?.full_name || "Student"} checked in successfully.`
      );

      setCheckInMessageType("success");
      setTicketCode("");

      await loadEventCheckIns();
    } catch (error) {
      console.error("Ticket check-in failed:", error);

      setCheckInMessage("Could not connect to the Eventeye server.");
      setCheckInMessageType("error");
    } finally {
      setCheckingInTicket(false);
    }
  };

  return (
    <div className="organizer-layout">
      <aside className="organizer-sidebar">
        <Logo compact />

        <div className="organizer-account">
          <div className="organizer-avatar">
            {user?.full_name?.charAt(0) || "O"}
          </div>

          <div>
            <strong>{user?.full_name || "Organizer"}</strong>
            <span>Event Organizer</span>
          </div>
        </div>

        <nav className="organizer-nav">
          <button
            className={activeView === "dashboard" ? "active" : ""}
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={activeView === "create-event" ? "active" : ""}
            onClick={() => setActiveView("create-event")}
          >
            Create Event
          </button>

          <button
            type="button"
            className={activeView === "manage-events" ? "active" : ""}
            onClick={() => {
              setActiveView("manage-events");
              setSelectedEvent(null);
              setEditingEvent(null);
              setActionMessage("");
            }}
          >
            Manage Events
          </button>

          <button
            type="button"
            className={activeView === "check-in" ? "active" : ""}
            onClick={() => setActiveView("check-in")}
          >
            Ticket Check-in
          </button>

          <button
            type="button"
            className={activeView === "analytics" ? "active" : ""}
            onClick={() => setActiveView("analytics")}
          >
            Analytics
          </button>

          <button
            type="button"
            className={activeView === "profile" ? "active" : ""}
            onClick={() => setActiveView("profile")}
          >
            Profile
          </button>
        </nav>

        <div className="organizer-sidebar-note">
          <span>EVENTEYE FOR ORGANIZERS</span>

          <p>
            Create better campus experiences and understand your audience.
          </p>
        </div>
      </aside>

      <main className="organizer-main">
        {activeView === "dashboard" && (
          <>
            <header className="organizer-header">
              <div>
                <span className="organizer-eyebrow">
                  ORGANIZER SPACE
                </span>

                <h1>
                  Welcome back, {user?.full_name || "Organizer"}
                </h1>

                <p>
                  Here’s how your events are performing.
                </p>
              </div>

              <div className="organizer-header-actions">
                <button
                  type="button"
                  className="organizer-notification"
                >
                  🔔
                </button>

                <button
                  type="button"
                  className="organizer-create-button"
                  onClick={() => setActiveView("create-event")}
                >
                  + Create Event
                </button>
              </div>
            </header>

            <section className="organizer-stats-grid">
              <StatCard
                label="Total Events"
                value={totalEvents}
                note="All your events"
              />

              <StatCard
                label="Upcoming"
                value={allUpcomingEvents.length}
                note="Future events"
              />

              <StatCard
                label="Past Events"
                value={pastEvents.length}
                note="Event history"
              />

              <StatCard
                label="Cancelled"
                value={cancelledEvents.length}
                note="Cancelled events"
              />
            </section>

            <section className="organizer-content-grid">
              <div className="organizer-events-panel">
                <div className="organizer-section-heading">
                  <div>
                    <span>YOUR EVENTS</span>
                    <h2>Upcoming Events</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveView("manage-events")}
                  >
                    Manage Events →
                  </button>
                </div>

                {loading ? (
                  <p style={{ padding: "0 24px 24px" }}>
                    Loading events...
                  </p>
                ) : upcomingEvents.length === 0 ? (
                  <div className="organizer-empty-state">
                    <h3>No upcoming events</h3>

                    <p>
                      Create a new event and it will appear here.
                    </p>

                    <button
                      type="button"
                      onClick={() => setActiveView("create-event")}
                      style={{ marginTop: "16px" }}
                    >
                      + Create Event
                    </button>
                  </div>
                ) : (
                  <div className="organizer-event-list">
                    {upcomingEvents.map((event) => (
                      <div
                        className="organizer-event-row"
                        key={event.event_id}
                      >
                        <div className="organizer-date-box">
                          <strong>{getDay(event.event_date)}</strong>
                          <span>{getMonth(event.event_date)}</span>
                        </div>

                        <div className="organizer-event-info">
                          <span className="organizer-event-category">
                            {event.category_name}
                          </span>

                          <h3>{event.event_name}</h3>

                          <p>
                            {formatDate(event.event_date)}
                            {" · "}
                            {event.location}
                          </p>

                          <p>
                            Status: {formatStatus(event.status)}
                          </p>
                        </div>

                        <div className="organizer-event-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveView("manage-events");
                              handleViewEvent(event);
                            }}
                          >
                            Manage
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <aside className="organizer-side-panel">
                <div className="organizer-quick-action-card">
                  <span className="organizer-card-label">
                    QUICK ACTION
                  </span>

                  <h2>Create your next campus event</h2>

                  <p>
                    Add your event details, category, date, venue and
                    capacity, then start accepting student bookings.
                  </p>

                  <button
                    type="button"
                    onClick={() => setActiveView("create-event")}
                  >
                    + Create Event
                  </button>
                </div>

                <div className="organizer-checkin-card">
                  <span className="organizer-card-label">
                    EVENT DAY
                  </span>

                  <h3>Ticket Check-in</h3>

                  <p>
                    Verify student tickets and record attendance.
                  </p>

                  <button
                    type="button"
                    onClick={() => setActiveView("check-in")}
                  >
                    Open Check-in
                  </button>
                </div>
              </aside>
            </section>

            <section className="organizer-insights">
              <div className="organizer-section-heading">
                <div>
                  <span>EVENT HISTORY</span>
                  <h2>Your event activity</h2>
                </div>
              </div>

              <div className="organizer-insight-placeholder">
                <div>
                  <span>Upcoming</span>
                  <strong>{allUpcomingEvents.length}</strong>
                </div>

                <div>
                  <span>Past</span>
                  <strong>{pastEvents.length}</strong>
                </div>

                <div>
                  <span>Cancelled</span>
                  <strong>{cancelledEvents.length}</strong>
                </div>

                <div>
                  <span>Total</span>
                  <strong>{totalEvents}</strong>
                </div>
              </div>
            </section>
          </>
        )}

        {activeView === "manage-events" && (
          <>
            <header className="organizer-header">
              <div>
                <span className="organizer-eyebrow">
                  EVENT MANAGEMENT
                </span>

                <h1>Manage Events</h1>

                <p>
                  View, edit and manage all your published events.
                </p>
              </div>

              <div className="organizer-header-actions">
                <button
                  type="button"
                  className="organizer-create-button"
                  onClick={() => setActiveView("create-event")}
                >
                  + Create Event
                </button>
              </div>
            </header>

            {actionMessage && (
              <MessageBox
                type={actionType}
                message={actionMessage}
              />
            )}

            <section style={panelStyle}>
              <div style={filterRowStyle}>
                <input
                  type="text"
                  placeholder="Search your events..."
                  value={manageSearch}
                  onChange={(event) =>
                    setManageSearch(event.target.value)
                  }
                  style={{
                    ...inputStyle,
                    flex: "1",
                    minWidth: "240px",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <FilterButton
                    label="All"
                    active={manageFilter === "all"}
                    onClick={() => setManageFilter("all")}
                  />

                  <FilterButton
                    label="Upcoming"
                    active={manageFilter === "upcoming"}
                    onClick={() => setManageFilter("upcoming")}
                  />

                  <FilterButton
                    label="Past"
                    active={manageFilter === "past"}
                    onClick={() => setManageFilter("past")}
                  />

                  <FilterButton
                    label="Cancelled"
                    active={manageFilter === "cancelled"}
                    onClick={() => setManageFilter("cancelled")}
                  />
                </div>
              </div>
            </section>

            <section className="organizer-events-panel">
              <div className="organizer-section-heading">
                <div>
                  <span>YOUR EVENTS</span>

                  <h2>
                    {managedEvents.length} event
                    {managedEvents.length === 1 ? "" : "s"}
                  </h2>
                </div>
              </div>

              {loading ? (
                <p style={{ padding: "0 24px 24px" }}>
                  Loading events...
                </p>
              ) : managedEvents.length === 0 ? (
                <div className="organizer-empty-state">
                  <h3>No events found</h3>
                  <p>Try another search or filter.</p>
                </div>
              ) : (
                <div className="organizer-event-list">
                  {managedEvents.map((event) => (
                    <div
                      className="organizer-event-row"
                      key={event.event_id}
                    >
                      <div className="organizer-date-box">
                        <strong>{getDay(event.event_date)}</strong>
                        <span>{getMonth(event.event_date)}</span>
                      </div>

                      <div className="organizer-event-info">
                        <span className="organizer-event-category">
                          {event.category_name}
                        </span>

                        <h3>{event.event_name}</h3>

                        <p>
                          {formatDate(event.event_date)}
                          {" · "}
                          {event.location}
                        </p>

                        <StatusBadge status={getDisplayStatus(event)} />
                      </div>

                      <div
                        className="organizer-event-actions"
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleViewEvent(event)}
                        >
                          View
                        </button>

                        {event.status !== "cancelled" &&
                          new Date(event.event_date) >= new Date() && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(event)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={
                                  cancellingEventId === event.event_id
                                }
                                onClick={() => handleCancelEvent(event)}
                                style={{ color: "#b23c3c" }}
                              >
                                {cancellingEventId === event.event_id
                                  ? "Cancelling..."
                                  : "Cancel"}
                              </button>
                            </>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {selectedEvent && (
              <section style={detailPanelStyle}>
                <div style={headingRowStyle}>
                  <div>
                    <span className="organizer-eyebrow">
                      EVENT DETAILS
                    </span>

                    <h2>{selectedEvent.event_name}</h2>

                    <StatusBadge
                      status={getDisplayStatus(selectedEvent)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                  >
                    ✕
                  </button>
                </div>

                <div style={infoGridStyle}>
                  <InfoBox
                    label="Category"
                    value={selectedEvent.category_name}
                  />

                  <InfoBox
                    label="Location"
                    value={selectedEvent.location}
                  />

                  <InfoBox
                    label="Start"
                    value={formatDate(selectedEvent.event_date)}
                  />

                  <InfoBox
                    label="End"
                    value={
                      selectedEvent.end_date
                        ? formatDate(selectedEvent.end_date)
                        : "Not specified"
                    }
                  />

                  <InfoBox
                    label="Capacity"
                    value={selectedEvent.capacity || "Unlimited"}
                  />
                </div>

                <div style={{ marginTop: "20px" }}>
                  <strong>Description</strong>

                  <p
                    style={{
                      color: "#716b78",
                      lineHeight: "1.6",
                    }}
                  >
                    {selectedEvent.description}
                  </p>
                </div>
              </section>
            )}

            {editingEvent && (
              <section style={detailPanelStyle}>
                <div style={headingRowStyle}>
                  <div>
                    <span className="organizer-eyebrow">
                      EDIT EVENT
                    </span>

                    <h2>Update Event</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={handleSaveEdit}
                  style={{
                    marginTop: "20px",
                    display: "grid",
                    gap: "16px",
                  }}
                >
                  <OrganizerField
                    label="Event Name"
                    name="event_name"
                    value={editingEvent.event_name}
                    onChange={handleEditChange}
                  />

                  <label style={fieldLabelStyle}>
                    <strong>Description</strong>

                    <textarea
                      name="description"
                      rows="5"
                      value={editingEvent.description}
                      onChange={handleEditChange}
                      style={inputStyle}
                    />
                  </label>

                  <OrganizerField
                    label="Location"
                    name="location"
                    value={editingEvent.location}
                    onChange={handleEditChange}
                  />

                  <div style={infoGridStyle}>
                    <OrganizerField
                      label="Start Date & Time"
                      name="event_date"
                      type="datetime-local"
                      min={todayDateTime}
                      value={editingEvent.event_date}
                      onChange={handleEditChange}
                    />

                    <OrganizerField
                      label="End Date & Time"
                      name="end_date"
                      type="datetime-local"
                      min={editingEvent.event_date || todayDateTime}
                      value={editingEvent.end_date}
                      onChange={handleEditChange}
                    />

                    <OrganizerField
                      label="Capacity"
                      name="capacity"
                      type="number"
                      min="1"
                      value={editingEvent.capacity}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div style={actionRowStyle}>
                    <button
                      type="button"
                      onClick={() => setEditingEvent(null)}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="organizer-create-button"
                      disabled={savingEdit}
                    >
                      {savingEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </>
        )}

        {activeView === "check-in" && (
          <>
            <header className="organizer-header">
              <div>
                <span className="organizer-eyebrow">
                  EVENT DAY
                </span>

                <h1>Ticket Check-in</h1>

                <p>
                  Verify student tickets and record attendance.
                </p>
              </div>
            </header>

            <section
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1fr) minmax(280px, 0.42fr)",
                gap: "20px",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "20px",
                }}
              >
                <section style={panelStyle}>
                  <span className="organizer-eyebrow">
                    SELECT EVENT
                  </span>

                  <h2>Event Check-in Desk</h2>

                  <p style={{ color: "#716b78" }}>
                    Choose the event you are checking students into.
                  </p>

                  <select
                    value={checkInEventId}
                    onChange={handleCheckInEventChange}
                    style={{
                      ...inputStyle,
                      marginTop: "12px",
                    }}
                  >
                    <option value="">Select an event</option>

                    {events
                      .filter(
                        (event) => event.status !== "cancelled"
                      )
                      .map((event) => (
                        <option
                          key={event.event_id}
                          value={event.event_id}
                        >
                          {event.event_name} —{" "}
                          {formatShortDate(event.event_date)}
                        </option>
                      ))}
                  </select>
                </section>

                <section style={panelStyle}>
                  <span className="organizer-eyebrow">
                    VERIFY TICKET
                  </span>

                  <h2>Enter Ticket Code</h2>

                  <p style={{ color: "#716b78" }}>
                    Enter the code shown below the student's QR ticket.
                  </p>

                  <form
                    onSubmit={handleVerifyTicket}
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="EVT-XXXXXXXX"
                      value={ticketCode}
                      onChange={(event) =>
                        setTicketCode(event.target.value.toUpperCase())
                      }
                      style={{
                        ...inputStyle,
                        flex: "1",
                        minWidth: "220px",
                        textTransform: "uppercase",
                      }}
                    />

                    <button
                      type="submit"
                      className="organizer-create-button"
                      disabled={verifyingTicket}
                    >
                      {verifyingTicket
                        ? "Verifying..."
                        : "Verify Ticket"}
                    </button>
                  </form>

                  {checkInMessage && (
                    <div style={{ marginTop: "16px" }}>
                      <MessageBox
                        type={checkInMessageType}
                        message={checkInMessage}
                      />
                    </div>
                  )}
                </section>

                {verifiedTicket && (
                  <section style={detailPanelStyle}>
                    <div style={headingRowStyle}>
                      <div>
                        <span className="organizer-eyebrow">
                          TICKET RESULT
                        </span>

                        <h2>
                          {verifiedTicket.student?.full_name}
                        </h2>
                      </div>

                      <StatusBadge
                        status={
                          verifiedTicket.ticket?.ticket_status ===
                          "used"
                            ? "Checked In"
                            : verifiedTicket.valid
                            ? "Valid"
                            : "Invalid"
                        }
                      />
                    </div>

                    <div style={infoGridStyle}>
                      <InfoBox
                        label="Ticket Code"
                        value={
                          verifiedTicket.ticket?.ticket_code || "—"
                        }
                      />

                      <InfoBox
                        label="Student"
                        value={
                          verifiedTicket.student?.full_name || "—"
                        }
                      />

                      <InfoBox
                        label="Email"
                        value={
                          verifiedTicket.student?.email || "—"
                        }
                      />

                      <InfoBox
                        label="Event"
                        value={
                          verifiedTicket.event?.event_name || "—"
                        }
                      />

                      <InfoBox
                        label="Venue"
                        value={
                          verifiedTicket.event?.location || "—"
                        }
                      />

                      <InfoBox
                        label="Booking"
                        value={formatStatus(
                          verifiedTicket.booking?.booking_status ||
                            "unknown"
                        )}
                      />
                    </div>

                    {verifiedTicket.ticket?.checked_in_at && (
                      <p
                        style={{
                          marginTop: "18px",
                          color: "#716b78",
                        }}
                      >
                        Checked in:{" "}
                        <strong>
                          {formatDate(
                            verifiedTicket.ticket.checked_in_at
                          )}
                        </strong>
                      </p>
                    )}

                    {verifiedTicket.valid && (
                      <div style={actionRowStyle}>
                        <button
                          type="button"
                          className="organizer-create-button"
                          onClick={handleCheckInTicket}
                          disabled={checkingInTicket}
                        >
                          {checkingInTicket
                            ? "Checking In..."
                            : "✓ Confirm Check-in"}
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </div>

              <aside
                style={{
                  display: "grid",
                  gap: "16px",
                }}
              >
                <section style={panelStyle}>
                  <span className="organizer-eyebrow">
                    ATTENDANCE
                  </span>

                  <h2>Check-in Summary</h2>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      marginTop: "18px",
                    }}
                  >
                    <MiniStat
                      label="Booked"
                      value={checkInSummary.total_booked}
                    />

                    <MiniStat
                      label="Checked In"
                      value={checkInSummary.total_checked_in}
                    />

                    <MiniStat
                      label="Remaining"
                      value={checkInSummary.remaining}
                    />
                  </div>
                </section>
              </aside>
            </section>

            <section
              style={{
                ...panelStyle,
                marginTop: "20px",
              }}
            >
              <div style={headingRowStyle}>
                <div>
                  <span className="organizer-eyebrow">
                    ATTENDEE LIST
                  </span>

                  <h2>Student Check-ins</h2>
                </div>

                {checkInEventId && (
                  <button
                    type="button"
                    onClick={loadEventCheckIns}
                  >
                    Refresh
                  </button>
                )}
              </div>

              {!checkInEventId ? (
                <div
                  style={{
                    padding: "30px 0",
                    color: "#817a89",
                  }}
                >
                  Select an event to view its attendee list.
                </div>
              ) : loadingCheckIns ? (
                <div style={{ padding: "30px 0" }}>
                  Loading attendees...
                </div>
              ) : checkInList.length === 0 ? (
                <div
                  style={{
                    padding: "30px 0",
                    color: "#817a89",
                  }}
                >
                  No student bookings for this event yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    marginTop: "18px",
                  }}
                >
                  {checkInList.map((attendee) => {
                    const checkedIn =
                      attendee.ticket_status === "used" ||
                      attendee.booking_status === "attended";

                    return (
                      <div
                        key={attendee.booking_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 1fr) auto",
                          gap: "16px",
                          alignItems: "center",
                          padding: "14px 16px",
                          border: "1px solid #ece8f0",
                          borderRadius: "12px",
                          background: "#ffffff",
                        }}
                      >
                        <div>
                          <strong>
                            {attendee.student?.full_name}
                          </strong>

                          <p
                            style={{
                              margin: "4px 0 0",
                              color: "#817a89",
                              fontSize: "12px",
                            }}
                          >
                            {attendee.student?.email}
                            {" · "}
                            {attendee.ticket_code || "No ticket"}
                          </p>
                        </div>

                        <StatusBadge
                          status={
                            checkedIn
                              ? "Checked In"
                              : "Not Checked In"
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeView === "analytics" && (
          <OrganizerAnalytics
            user={user}
            onBack={() => setActiveView("dashboard")}
          />
        )}

        {activeView === "profile" && (
          <OrganizerProfile
            user={user}
            onBack={() => setActiveView("dashboard")}
          />
        )}
      </main>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: active
          ? "1px solid #6c5ce7"
          : "1px solid #ded8e7",
        background: active
          ? "#f0ecff"
          : "#ffffff",
        color: active
          ? "#6558f5"
          : "#514958",
        fontWeight: "700",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StatusBadge({
  status,
}) {
  const statusLower =
    status?.toLowerCase() || "unknown";

  let background = "#f1eef5";
  let color = "#625a68";

  if (
    statusLower === "upcoming" ||
    statusLower === "valid" ||
    statusLower === "checked in"
  ) {
    background = "#edf9f2";
    color = "#26734d";
  }

  if (
    statusLower === "past" ||
    statusLower === "not checked in"
  ) {
    background = "#f2f2f4";
    color = "#63606a";
  }

  if (
    statusLower === "cancelled" ||
    statusLower === "invalid"
  ) {
    background = "#fff1f1";
    color = "#a23d3d";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        marginTop: "8px",
        padding: "6px 10px",
        borderRadius: "999px",
        background,
        color,
        fontSize: "11px",
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status}
    </span>
  );
}

function InfoBox({
  label,
  value,
}) {
  return (
    <div
      style={{
        background: "#f8f7fa",
        borderRadius: "12px",
        padding: "15px",
      }}
    >
      <span
        style={{
          display: "block",
          color: "#867e8e",
          fontSize: "11px",
          marginBottom: "6px",
          fontWeight: "700",
        }}
      >
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

function MiniStat({
  label,
  value,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#f8f7fa",
        borderRadius: "12px",
        padding: "14px",
      }}
    >
      <span
        style={{
          color: "#716b78",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: "20px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function MessageBox({
  type,
  message,
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "12px",
        background:
          type === "success"
            ? "#edf9f2"
            : "#fff1f1",
        color:
          type === "success"
            ? "#236d49"
            : "#a23d3d",
        border:
          type === "success"
            ? "1px solid #c9ebd7"
            : "1px solid #f3cccc",
        fontWeight: "600",
      }}
    >
      {message}
    </div>
  );
}

function OrganizerField({
  label,
  name,
  value,
  onChange,
  type = "text",
  min,
}) {
  return (
    <label style={fieldLabelStyle}>
      <strong>{label}</strong>

      <input
        type={type}
        name={name}
        value={value || ""}
        min={min}
        onChange={onChange}
        style={inputStyle}
      />
    </label>
  );
}

function StatCard({
  label,
  value,
  note,
}) {
  return (
    <div className="organizer-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #e8e4ee",
  borderRadius: "18px",
  padding: "24px",
};

const detailPanelStyle = {
  ...panelStyle,
  marginTop: "22px",
};

const filterRowStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
};

const headingRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "flex-start",
};

const infoGridStyle = {
  marginTop: "22px",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
};

const actionRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "20px",
};

const fieldLabelStyle = {
  display: "grid",
  gap: "7px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  borderRadius: "10px",
  border: "1px solid #ded8e7",
  font: "inherit",
  outline: "none",
};

function formatDate(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatShortDate(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function getDay(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
    }
  );
}

function getMonth(date) {
  if (!date) {
    return "";
  }

  return new Date(date)
    .toLocaleDateString(
      "en-GB",
      {
        month: "short",
      }
    )
    .toUpperCase();
}

function formatStatus(status) {
  if (!status) {
    return "Unknown";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
}

function getDisplayStatus(event) {
  if (event.status === "cancelled") {
    return "Cancelled";
  }

  if (
    event.event_date &&
    new Date(event.event_date) < new Date()
  ) {
    return "Past";
  }

  return "Upcoming";
}

function toDateTimeLocal(date) {
  if (!date) {
    return "";
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  const year = value.getFullYear();

  const month = String(
    value.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    value.getDate()
  ).padStart(2, "0");

  const hours = String(
    value.getHours()
  ).padStart(2, "0");

  const minutes = String(
    value.getMinutes()
  ).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default OrganizerDashboard;