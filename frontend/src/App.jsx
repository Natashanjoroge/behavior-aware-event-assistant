import { useState } from "react";
import Login from "./pages/login";
import Register from "./pages/register";
import Onboarding from "./pages/onboarding";
import StudentDashboard from "./pages/studentDashboard";

function App() {
  const [page, setPage] = useState("login");
  const [user, setUser] = useState(null);

  const handleLogin = async (loggedInUser) => {
    setUser(loggedInUser);

    if (loggedInUser.user_type === "organizer") {
      setPage("organizer-dashboard");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/preferences/user/${loggedInUser.user_id}`
      );

      const preferences = await response.json();

      if (!response.ok) {
        setPage("onboarding");
        return;
      }

      if (preferences.length === 0) {
        setPage("onboarding");
      } else {
        setPage("student-dashboard");
      }
    } catch {
      setPage("onboarding");
    }
  };

  if (page === "register") {
    return (
      <Register
        onSwitch={() => setPage("login")}
      />
    );
  }

  if (page === "onboarding" && user) {
    return (
      <Onboarding
        user={user}
        onComplete={() => setPage("student-dashboard")}
      />
    );
  }

  if (page === "student-dashboard" && user) {
  return <StudentDashboard user={user} />;
}

  if (page === "organizer-dashboard" && user) {
    return (
      <div style={{ padding: "40px" }}>
        <h1>Organizer Dashboard</h1>
        <p>Welcome, {user.full_name}</p>
      </div>
    );
  }

  return (
    <Login
      onSwitch={() => setPage("register")}
      onLogin={handleLogin}
    />
  );
}

export default App;