import { useState } from "react";
import { LoginView } from "./login/LoginView.js";
import { DashboardView } from "./dashboard/DashboardView.js";
import { useRefreshResize } from "./hooks/refresh-resize.js";

export default function App() {
  const [view, setView] = useState<"login" | "dashboard">("login");
  const r = useRefreshResize();
  return (
    <>
      {view === "login" ? (
        <LoginView onLogin={() => setView("dashboard")} />
      ) : (
        <DashboardView onLogout={() => setView("login")} />
      )}
      {r}
    </>
  );
}
