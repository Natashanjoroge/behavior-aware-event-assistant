import { useState } from "react";
import Logo from "../components/logo";
import "../styles/auth.css";

function Register({ onSwitch }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    user_type: "student",
  });

  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (form.password !== form.confirm_password) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            user_type: form.user_type,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed");
        return;
      }

      setMessage(
        "Account created successfully. You can now log in."
      );
    } catch {
      setMessage("Could not connect to the server");
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-logo">
          <Logo />
        </div>

        <div className="register-heading">
          <h1>Create your EventEye account</h1>

          <p>
            Join a campus community built around events,
            interests, and experiences.
          </p>
        </div>

        <form
          className="register-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="full_name">
            Full Name
          </label>

          <div className="register-input-wrapper">
            <span className="register-input-icon">
              👤
            </span>

            <input
              id="full_name"
              type="text"
              name="full_name"
              placeholder="Enter your full name"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <label htmlFor="email">
            University Email
          </label>

          <div className="register-input-wrapper">
            <span className="register-input-icon">
              ✉
            </span>

            <input
              id="email"
              type="email"
              name="email"
              placeholder="yourname@university.edu"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <label htmlFor="password">
            Password
          </label>

          <div className="register-input-wrapper">
            <span className="register-input-icon">
              🔒
            </span>

            <input
              id="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              name="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <button
              type="button"
              className="register-password-toggle"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          <label htmlFor="confirm_password">
            Confirm Password
          </label>

          <div className="register-input-wrapper">
            <span className="register-input-icon">
              🔒
            </span>

            <input
              id="confirm_password"
              type={
                showConfirmPassword
                  ? "text"
                  : "password"
              }
              name="confirm_password"
              placeholder="Confirm your password"
              value={form.confirm_password}
              onChange={handleChange}
              required
            />

            <button
              type="button"
              className="register-password-toggle"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
              aria-label={
                showConfirmPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showConfirmPassword
                ? "🙈"
                : "👁"}
            </button>
          </div>

          <label>
            Account Type
          </label>

          <div className="register-role-options">
            <div className="register-role-option">
              <input
                id="student"
                type="radio"
                name="user_type"
                value="student"
                checked={
                  form.user_type === "student"
                }
                onChange={handleChange}
              />

              <label htmlFor="student">
                <span className="role-icon">
                  🎓
                </span>

                <span className="role-copy">
                  <strong>Student</strong>
                  <small>
                    Join events and communities
                  </small>
                </span>
              </label>
            </div>

            <div className="register-role-option">
              <input
                id="organizer"
                type="radio"
                name="user_type"
                value="organizer"
                checked={
                  form.user_type ===
                  "organizer"
                }
                onChange={handleChange}
              />

              <label htmlFor="organizer">
                <span className="role-icon">
                  👥
                </span>

                <span className="role-copy">
                  <strong>Organizer</strong>
                  <small>
                    Create and manage your events
                  </small>
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="register-main-button"
          >
            Create Account →
          </button>
        </form>

        {message && (
          <div className="auth-message">
            {message}
          </div>
        )}

        <div className="register-divider">
          <span></span>
          <p>or continue with</p>
          <span></span>
        </div>

        <div className="register-social-row">
          <button
            type="button"
            className="register-social-button"
          >
            <span className="google-letter">
              G
            </span>
            Continue with Google
          </button>

          <button
            type="button"
            className="register-social-button"
          >
            <span className="microsoft-icon">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>

            Continue with Microsoft
          </button>
        </div>

        <p className="register-login-text">
          Already have an account?{" "}

          <button
            type="button"
            className="register-login-link"
            onClick={onSwitch}
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}

export default Register;