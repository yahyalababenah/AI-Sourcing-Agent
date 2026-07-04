import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/lib/i18n";
import "@/index.css";

// Apply persisted theme before first render to prevent flash of unstyled content.
// Defaults to light — the platform is a light-first B2B design (see CLAUDE.md).
try {
  const raw = localStorage.getItem("ai-sourcing-theme");
  const saved = raw ? JSON.parse(raw) : null;
  if (saved?.state?.theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
} catch {
  document.documentElement.classList.remove("dark");
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Root element not found. Make sure there is a <div id=\"root\"> in your index.html."
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
