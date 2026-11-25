import { useEffect, useState } from "react";
import Login from "./pages/login";
import Register from "./pages/register";
import Onboarding from "./pages/onboarding";
import StudentDashboard from "./pages/studentDashboard";
import OrganizerDashboard from "./pages/organizerdashboard";

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        localStorage.removeItem("user");
        return null;
      }
    }

    return null;
  });

  const [page, setPage] = useState(() => {
    const savedUser = localStorage.getItem("user");

    return savedUser ? "loading" : "login";
  });

  const routeUser = async (loggedInUser) => {
    if (!loggedInUser) {
      setPage("login");
      return;
    }

    // Organizer goes directly to organizer dashboard
    if (loggedInUser.user_type === "organizer") {
      setPage("organizer-dashboard");
      return;
    }

    // Student: check whether onboarding/preferences exist
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

  // Restore the correct page after browser refresh
  useEffect(() => {
    if (user) {
      routeUser(user);
    }
  }, []);

  const handleLogin = async (loggedInUser) => {
    localStorage.setItem(
      "user",
      JSON.stringify(loggedInUser)
    );

    setUser(loggedInUser);

    await routeUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");

    setUser(null);
    setPage("login");
  };

  if (page === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        Loading Eventeye...
      </div>
    );
  }

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
        onComplete={() =>
          setPage("student-dashboard")
        }
      />
    );
  }

  if (page === "student-dashboard" && user) {
    return (
      <StudentDashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  if (page === "organizer-dashboard" && user) {
    return (
      <OrganizerDashboard
        user={user}
        onLogout={handleLogout}
      />
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