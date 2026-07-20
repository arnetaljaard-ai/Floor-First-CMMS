import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for offline PWA support (plant floor dead-zones)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal — app still works online.
    });
  });
}
