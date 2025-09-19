import { useState } from "react";
import { LoginView } from "./login/LoginView.js";
import { DashboardView } from "./dashboard/DashboardView.js";

export default function App() {
  const [view, setView] = useState<"login" | "dashboard">("login");

  if (view === "login") {
    return <LoginView onLogin={() => setView("dashboard")} />;
  }

  return <DashboardView onLogout={() => setView("login")} />;
}
