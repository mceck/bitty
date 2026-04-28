import { useState } from "react";
import { useInput } from "ink";
import { LoginView } from "./login/LoginView.js";
import { DashboardView } from "./dashboard/DashboardView.js";
import { useRefreshResize } from "./hooks/refresh-resize.js";

export default function App() {
  const [view, setView] = useState<"login" | "dashboard">("login");
  const r = useRefreshResize();

  useInput((input, key) => {
    if (input === "c" && key.ctrl) process.exit(0);
  });

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
