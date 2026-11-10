import { useEffect, useRef, useState } from "react";
import "../styles/studentProfile.css";

function StudentProfile({
  user,
  onBack,
  onEditInterests,
  onLogout,
}) {
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [interests, setInterests] = useState([]);
  const [activity, setActivity] = useState({
    events_booked: 0,
    saved_events: 0,
    attended_events: 0,
  });

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    institution: "",
    year_of_study: "",
  });

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const [showPasswordForm, setShowPasswordForm] =
    useState(false);

  const [passwordData, setPasswordData] =
    useState({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });

  const [changingPassword, setChangingPassword] =
    useState(false);

  /* =========================
     LOAD PROFILE
  ========================= */

  const loadProfile = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load profile."
        );
      }

      setProfile(data.profile);
      setInterests(data.interests || []);

      setActivity(
        data.activity || {
          events_booked: 0,
          saved_events: 0,
          attended_events: 0,
        }
      );

      setFormData({
        full_name:
          data.profile?.full_name || "",

        email:
          data.profile?.email || "",

        phone_number:
          data.profile?.phone_number || "",

        institution:
          data.profile?.institution || "",

        year_of_study:
          data.profile?.year_of_study || "",
      });
    } catch (error) {
      console.error(
        "Profile loading error:",
        error
      );

      setMessage(
        error.message ||
          "Could not load your profile."
      );

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  /* =========================
     INPUT CHANGE
  ========================= */

  const handleInputChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* =========================
     SAVE PROFILE
  ========================= */

  const saveProfile = async () => {
    if (!user?.user_id) return;

    if (!formData.full_name.trim()) {
      setMessage("Full name is required.");
      setMessageType("error");
      return;
    }

    if (!formData.email.trim()) {
      setMessage("Email is required.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            full_name:
              formData.full_name.trim(),

            email:
              formData.email.trim(),

            phone_number:
              formData.phone_number.trim() ||
              null,

            institution:
              formData.institution.trim() ||
              null,

            year_of_study:
              formData.year_of_study.trim() ||
              null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update profile."
        );
      }

      setMessage(
        "Profile updated successfully."
      );

      setMessageType("success");
      setEditing(false);

      await loadProfile();
    } catch (error) {
      console.error(
        "Profile update error:",
        error
      );

      setMessage(
        error.message ||
          "Could not update your profile."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     PHOTO UPLOAD
  ========================= */

  const handlePhotoSelect = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file || !user?.user_id) {
      return;
    }

    setUploadingPhoto(true);
    setMessage("");

    try {
      const photoForm =
        new FormData();

      photoForm.append(
        "photo",
        file
      );

      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}/photo`,
        {
          method: "POST",
          body: photoForm,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not upload photo."
        );
      }

      setMessage(
        "Profile photo updated."
      );

      setMessageType("success");

      await loadProfile();
    } catch (error) {
      console.error(
        "Photo upload error:",
        error
      );

      setMessage(
        error.message ||
          "Could not upload profile photo."
      );

      setMessageType("error");
    } finally {
      setUploadingPhoto(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /* =========================
     PASSWORD CHANGE
  ========================= */

  const handlePasswordChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setPasswordData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const changePassword = async (
    event
  ) => {
    event.preventDefault();

    if (!user?.user_id) return;

    setChangingPassword(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}/password`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            passwordData
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not change password."
        );
      }

      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      setShowPasswordForm(false);

      setMessage(
        "Password changed successfully."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Password change error:",
        error
      );

      setMessage(
        error.message ||
          "Could not change password."
      );

      setMessageType("error");
    } finally {
      setChangingPassword(false);
    }
  };

  /* =========================
     CANCEL EDIT
  ========================= */

  const cancelEditing = () => {
    setEditing(false);

    setFormData({
      full_name:
        profile?.full_name || "",

      email:
        profile?.email || "",

      phone_number:
        profile?.phone_number || "",

      institution:
        profile?.institution || "",

      year_of_study:
        profile?.year_of_study || "",
    });
  };

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="student-profile-page">
        <div className="profile-loading">
          Loading your profile...
        </div>
      </div>
    );
  }

  return (
    <div className="student-profile-page">

      {/* TOP */}

      <div className="student-profile-top">

        <div>
          {onBack && (
            <button
              type="button"
              className="profile-back-button"
              onClick={onBack}
            >
              ← Back
            </button>
          )}

          <h1>My Profile</h1>

          <p>
            Manage your personal information
            and Eventeye account.
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            className="profile-edit-button"
            onClick={() =>
              setEditing(true)
            }
          >
            ✎ Edit Profile
          </button>
        )}

      </div>

      {message && (
        <div
          className={`profile-message ${messageType}`}
        >
          {message}
        </div>
      )}

      {/* PROFILE HERO */}

      <section className="profile-hero-card">

        <div className="profile-photo-wrap">

          {profile?.profile_photo ? (
            <img
              src={profile.profile_photo}
              alt="Profile"
              className="profile-photo"
            />
          ) : (
            <div className="profile-photo-placeholder">
              {profile?.full_name
                ?.charAt(0)
                ?.toUpperCase() || "S"}
            </div>
          )}

          <button
            type="button"
            className="profile-photo-button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={uploadingPhoto}
            title="Change profile photo"
          >
            {uploadingPhoto
              ? "..."
              : "📷"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={handlePhotoSelect}
            hidden
          />

        </div>

        <div className="profile-identity">

          <div className="profile-role">
            STUDENT
          </div>

          <h2>
            {profile?.full_name ||
              "Student"}
          </h2>

          <p>
            {profile?.email}
          </p>

          {profile?.institution && (
            <span>
              🎓 {profile.institution}
            </span>
          )}

        </div>

      </section>

      {/* STATS */}

      <section className="profile-stat-grid">

        <ProfileStat
          number={activity.events_booked}
          label="Events Booked"
          icon="🎟️"
        />

        <ProfileStat
          number={activity.saved_events}
          label="Saved Events"
          icon="♥"
        />

        <ProfileStat
          number={activity.attended_events}
          label="Events Attended"
          icon="✓"
        />

      </section>

      <div className="profile-content-grid">

        {/* PERSONAL DETAILS */}

        <section className="profile-panel personal-panel">

          <div className="profile-panel-heading">
            <div>
              <h2>
                Personal Information
              </h2>

              <p>
                Your basic Eventeye profile details.
              </p>
            </div>
          </div>

          <div className="profile-form-grid">

            <ProfileField
              label="Full Name"
              name="full_name"
              value={formData.full_name}
              editing={editing}
              onChange={
                handleInputChange
              }
            />

            <ProfileField
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              editing={editing}
              onChange={
                handleInputChange
              }
            />

            <ProfileField
              label="Phone Number"
              name="phone_number"
              value={
                formData.phone_number
              }
              editing={editing}
              placeholder="+254..."
              onChange={
                handleInputChange
              }
            />

            <ProfileField
              label="Institution"
              name="institution"
              value={
                formData.institution
              }
              editing={editing}
              placeholder="Your institution"
              onChange={
                handleInputChange
              }
            />

            <ProfileField
              label="Year of Study"
              name="year_of_study"
              value={
                formData.year_of_study
              }
              editing={editing}
              placeholder="e.g. 4th Year"
              onChange={
                handleInputChange
              }
            />

          </div>

          {editing && (
            <div className="profile-save-row">

              <button
                type="button"
                className="profile-cancel-button"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="profile-save-button"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>
          )}

        </section>

        {/* INTERESTS */}

        <section className="profile-panel">

          <div className="profile-panel-heading profile-heading-action">

            <div>
              <h2>
                My Interests
              </h2>

              <p>
                These help Eventeye personalize
                your recommendations.
              </p>
            </div>

            {onEditInterests && (
              <button
                type="button"
                className="profile-link-button"
                onClick={onEditInterests}
              >
                Edit
              </button>
            )}

          </div>

          {interests.length === 0 ? (
            <div className="profile-empty">
              No interests selected yet.
            </div>
          ) : (
            <div className="profile-interest-list">

              {interests.map(
                (interest) => (
                  <span
                    key={
                      interest.category_id
                    }
                    className="profile-interest-tag"
                  >
                    {getInterestIcon(
                      interest.category_name
                    )}

                    {
                      interest.category_name
                    }
                  </span>
                )
              )}

            </div>
          )}

        </section>

        {/* ACCOUNT INFO */}

        <section className="profile-panel">

          <div className="profile-panel-heading">

            <div>
              <h2>
                Account
              </h2>

              <p>
                Security and account information.
              </p>
            </div>

          </div>

          <div className="account-detail-list">

            <div>
              <span>
                Account Type
              </span>

              <strong>
                Student
              </strong>
            </div>

            <div>
              <span>
                Member Since
              </span>

              <strong>
                {formatProfileDate(
                  profile?.created_at
                )}
              </strong>
            </div>

            <div>
              <span>
                Last Login
              </span>

              <strong>
                {formatProfileDateTime(
                  profile?.last_login
                )}
              </strong>
            </div>

          </div>

          <div className="profile-account-actions">

            <button
              type="button"
              className="change-password-button"
              onClick={() =>
                setShowPasswordForm(
                  (current) =>
                    !current
                )
              }
            >
              🔒 Change Password
            </button>

            {onLogout && (
              <button
                type="button"
                className="profile-logout-button"
                onClick={onLogout}
              >
                ↪ Log Out
              </button>
            )}

          </div>

          {showPasswordForm && (
            <form
              className="password-form"
              onSubmit={
                changePassword
              }
            >

              <h3>
                Change Password
              </h3>

              <label>
                Current Password

                <input
                  type="password"
                  name="current_password"
                  value={
                    passwordData.current_password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  required
                />
              </label>

              <label>
                New Password

                <input
                  type="password"
                  name="new_password"
                  value={
                    passwordData.new_password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  required
                />
              </label>

              <label>
                Confirm New Password

                <input
                  type="password"
                  name="confirm_password"
                  value={
                    passwordData.confirm_password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  required
                />
              </label>

              <div className="password-actions">

                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={() =>
                    setShowPasswordForm(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={
                    changingPassword
                  }
                >
                  {changingPassword
                    ? "Updating..."
                    : "Update Password"}
                </button>

              </div>

            </form>
          )}

        </section>

      </div>
    </div>
  );
}


/* =========================
   PROFILE STAT
========================= */

function ProfileStat({
  number,
  label,
  icon,
}) {
  return (
    <div className="profile-stat-card">

      <div className="profile-stat-icon">
        {icon}
      </div>

      <div>
        <strong>
          {number}
        </strong>

        <span>
          {label}
        </span>
      </div>

    </div>
  );
}


/* =========================
   PROFILE FIELD
========================= */

function ProfileField({
  label,
  name,
  value,
  editing,
  onChange,
  type = "text",
  placeholder = "",
}) {
  return (
    <div className="profile-field">

      <label>
        {label}
      </label>

      {editing ? (
        <input
          type={type}
          name={name}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
        />
      ) : (
        <div className="profile-field-value">
          {value || "Not added yet"}
        </div>
      )}

    </div>
  );
}


/* =========================
   HELPERS
========================= */

function getInterestIcon(
  category
) {
  const icons = {
    "Social & Entertainment":
      "🎉",

    "Sports & Fitness":
      "🏀",

    "Academic & Educational":
      "📚",

    "Career & Professional":
      "💼",

    "Arts & Culture":
      "🎨",

    "Technology & Innovation":
      "💻",

    "Clubs & Societies":
      "👥",

    "Wellness & Lifestyle":
      "🌿",

    "Community & Volunteering":
      "🤝",

    "Faith & Spirituality":
      "✨",
  };

  return icons[category] || "⭐";
}


function formatProfileDate(date) {
  if (!date) {
    return "Not available";
  }

  return new Date(
    date
  ).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}


function formatProfileDateTime(
  date
) {
  if (!date) {
    return "Not available";
  }

  return new Date(
    date
  ).toLocaleString(
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


export default StudentProfile;