import { useEffect, useRef, useState } from "react";
import "../styles/organizerProfile.css";

function OrganizerProfile({ user, onBack }) {
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    institution: "",
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  /* =========================
     LOAD PROFILE
  ========================= */

  const loadProfile = async () => {
    if (!user?.user_id) {
      setLoading(false);

      setMessage(
        "Organizer account could not be identified."
      );

      setMessageType("error");

      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load organizer profile."
        );
      }

      setProfile(data);

      setFormData({
        full_name:
          data.full_name || "",

        email:
          data.email || "",

        phone_number:
          data.phone_number || "",

        institution:
          data.institution || "",
      });
    } catch (error) {
      console.error(
        "Organizer profile loading error:",
        error
      );

      setMessage(
        error.message ||
          "Could not connect to the Eventeye server."
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
     PROFILE FIELD CHANGE
  ========================= */

  const handleProfileChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  };

  /* =========================
     SAVE PROFILE
  ========================= */

  const handleSaveProfile = async (
    event
  ) => {
    event.preventDefault();

    if (!formData.full_name.trim()) {
      setMessage(
        "Organizer name is required."
      );

      setMessageType("error");
      return;
    }

    if (!formData.email.trim()) {
      setMessage(
        "Email address is required."
      );

      setMessageType("error");
      return;
    }

    setSavingProfile(true);
    setMessage("");
    setMessageType("");

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
              formData.phone_number.trim(),

            institution:
              formData.institution.trim(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not update organizer profile."
        );

        setMessageType("error");
        return;
      }

      setMessage(
        "Organizer profile updated successfully."
      );

      setMessageType("success");

      await loadProfile();
    } catch (error) {
      console.error(
        "Organizer profile update error:",
        error
      );

      setMessage(
        "Could not connect to the Eventeye server."
      );

      setMessageType("error");
    } finally {
      setSavingProfile(false);
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

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setMessage(
        "Please select an image file."
      );

      setMessageType("error");
      return;
    }

    const uploadData =
      new FormData();

    uploadData.append(
      "photo",
      file
    );

    setUploadingPhoto(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}/photo`,
        {
          method: "POST",
          body: uploadData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not upload profile photo."
        );

        setMessageType("error");
        return;
      }

      setMessage(
        "Profile photo updated successfully."
      );

      setMessageType("success");

      await loadProfile();
    } catch (error) {
      console.error(
        "Profile photo upload error:",
        error
      );

      setMessage(
        "Could not connect to the Eventeye server."
      );

      setMessageType("error");
    } finally {
      setUploadingPhoto(false);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  };

  /* =========================
     PASSWORD FIELD CHANGE
  ========================= */

  const handlePasswordChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setPasswordData(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  };

  /* =========================
     CHANGE PASSWORD
  ========================= */

  const handlePasswordSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (
      !passwordData.current_password
    ) {
      setMessage(
        "Enter your current password."
      );

      setMessageType("error");
      return;
    }

    if (
      !passwordData.new_password
    ) {
      setMessage(
        "Enter a new password."
      );

      setMessageType("error");
      return;
    }

    if (
      passwordData.new_password.length <
      6
    ) {
      setMessage(
        "New password must be at least 6 characters."
      );

      setMessageType("error");
      return;
    }

    if (
      passwordData.new_password !==
      passwordData.confirm_password
    ) {
      setMessage(
        "New passwords do not match."
      );

      setMessageType("error");
      return;
    }

    setChangingPassword(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/profile/${user.user_id}/password`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            current_password:
              passwordData.current_password,

            new_password:
              passwordData.new_password,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.message ||
            "Could not change password."
        );

        setMessageType("error");
        return;
      }

      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

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
        "Could not connect to the Eventeye server."
      );

      setMessageType("error");
    } finally {
      setChangingPassword(false);
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="organizer-profile-page">
        <div className="organizer-profile-loading">
          Loading organizer profile...
        </div>
      </div>
    );
  }

  /* =========================
     PROFILE PHOTO
  ========================= */

  const photoUrl =
    profile?.profile_photo
      ? `http://127.0.0.1:5000/${profile.profile_photo}`
      : null;

  const organizerInitial =
    (
      profile?.full_name ||
      user?.full_name ||
      "O"
    )
      .charAt(0)
      .toUpperCase();

  return (
    <div className="organizer-profile-page">

      {/* HEADER */}

      <header className="organizer-profile-header">

        <div>

          <button
            type="button"
            className="organizer-profile-back"
            onClick={onBack}
          >
            ← Back to Dashboard
          </button>

          <span className="organizer-profile-eyebrow">
            ORGANIZER ACCOUNT
          </span>

          <h1>
            Profile
          </h1>

          <p>
            Manage your organizer account,
            contact details and security.
          </p>

        </div>

      </header>

      {message && (
        <div
          className={`organizer-profile-message ${messageType}`}
        >
          {message}
        </div>
      )}

      {/* PROFILE SUMMARY */}

      <section className="organizer-profile-summary">

        <div className="organizer-profile-photo-area">

          <div className="organizer-profile-avatar">

            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Organizer profile"
              />
            ) : (
              <span>
                {organizerInitial}
              </span>
            )}

          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={
              handlePhotoSelect
            }
          />

          <button
            type="button"
            className="organizer-photo-button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={
              uploadingPhoto
            }
          >
            {uploadingPhoto
              ? "Uploading..."
              : "Change Photo"}
          </button>

        </div>

        <div className="organizer-profile-summary-info">

          <span className="organizer-profile-role">
            Event Organizer
          </span>

          <h2>
            {profile?.full_name ||
              user?.full_name ||
              "Organizer"}
          </h2>

          <p>
            {profile?.email ||
              user?.email ||
              ""}
          </p>

          {profile?.institution && (
            <small>
              {profile.institution}
            </small>
          )}

        </div>

      </section>

      <div className="organizer-profile-grid">

        {/* ACCOUNT DETAILS */}

        <section className="organizer-profile-panel">

          <div className="organizer-profile-section-heading">

            <span>
              PROFILE DETAILS
            </span>

            <h2>
              Organizer Information
            </h2>

            <p>
              Update the information students
              and Eventeye use for your account.
            </p>

          </div>

          <form
            onSubmit={
              handleSaveProfile
            }
            className="organizer-profile-form"
          >

            <ProfileField
              label="Organizer / Full Name"
              name="full_name"
              value={
                formData.full_name
              }
              onChange={
                handleProfileChange
              }
              required
            />

            <ProfileField
              label="Email Address"
              name="email"
              type="email"
              value={
                formData.email
              }
              onChange={
                handleProfileChange
              }
              required
            />

            <ProfileField
              label="Phone Number"
              name="phone_number"
              value={
                formData.phone_number
              }
              onChange={
                handleProfileChange
              }
              placeholder="+254..."
            />

            <ProfileField
              label="Institution / Organization"
              name="institution"
              value={
                formData.institution
              }
              onChange={
                handleProfileChange
              }
              placeholder="e.g. Strathmore University"
            />

            <div className="organizer-profile-actions">

              <button
                type="submit"
                className="organizer-profile-primary"
                disabled={
                  savingProfile
                }
              >
                {savingProfile
                  ? "Saving..."
                  : "Save Changes"}
              </button>

            </div>

          </form>

        </section>

        {/* ACCOUNT OVERVIEW */}

        <aside className="organizer-profile-side">

          <section className="organizer-profile-panel">

            <div className="organizer-profile-section-heading">

              <span>
                ACCOUNT
              </span>

              <h2>
                Account Overview
              </h2>

            </div>

            <div className="organizer-profile-info-list">

              <ProfileInfo
                label="Account Type"
                value="Organizer"
              />

              <ProfileInfo
                label="Member Since"
                value={
                  profile?.created_at
                    ? formatDate(
                        profile.created_at
                      )
                    : "Not available"
                }
              />

              <ProfileInfo
                label="Last Login"
                value={
                  profile?.last_login
                    ? formatDateTime(
                        profile.last_login
                      )
                    : "Not available"
                }
              />

              <ProfileInfo
                label="User ID"
                value={
                  user?.user_id ||
                  profile?.user_id ||
                  "—"
                }
              />

            </div>

          </section>

        </aside>

      </div>

      {/* PASSWORD */}

      <section className="organizer-profile-panel organizer-password-panel">

        <div className="organizer-profile-section-heading">

          <span>
            SECURITY
          </span>

          <h2>
            Change Password
          </h2>

          <p>
            Keep your Eventeye organizer account secure.
          </p>

        </div>

        <form
          onSubmit={
            handlePasswordSubmit
          }
          className="organizer-password-form"
        >

          <ProfileField
            label="Current Password"
            name="current_password"
            type="password"
            value={
              passwordData.current_password
            }
            onChange={
              handlePasswordChange
            }
            required
          />

          <ProfileField
            label="New Password"
            name="new_password"
            type="password"
            value={
              passwordData.new_password
            }
            onChange={
              handlePasswordChange
            }
            required
          />

          <ProfileField
            label="Confirm New Password"
            name="confirm_password"
            type="password"
            value={
              passwordData.confirm_password
            }
            onChange={
              handlePasswordChange
            }
            required
          />

          <div className="organizer-profile-actions">

            <button
              type="submit"
              className="organizer-profile-primary"
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

      </section>

    </div>
  );
}


/* =========================
   PROFILE FIELD
========================= */

function ProfileField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder = "",
  required = false,
}) {
  return (
    <label className="organizer-profile-field">

      <span>
        {label}
      </span>

      <input
        type={type}
        name={name}
        value={value || ""}
        placeholder={placeholder}
        required={required}
        onChange={onChange}
      />

    </label>
  );
}


/* =========================
   PROFILE INFO
========================= */

function ProfileInfo({
  label,
  value,
}) {
  return (
    <div className="organizer-profile-info-row">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


/* =========================
   DATE HELPERS
========================= */

function formatDate(date) {
  if (!date) {
    return "";
  }

  return new Date(
    date
  ).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}


function formatDateTime(date) {
  if (!date) {
    return "";
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


export default OrganizerProfile;