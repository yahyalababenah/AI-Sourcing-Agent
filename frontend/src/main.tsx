import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/lib/i18n";
import "@/index.css";

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
