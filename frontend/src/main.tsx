import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

// Apply persisted theme before first render to prevent flash of unstyled content
try {
  const raw = localStorage.getItem("ai-sourcing-theme");
  const saved = raw ? JSON.parse(raw) : null;
  if (saved?.state?.theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
} catch {
  document.documentElement.classList.add("dark");
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
