import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { DesktopOnlyGate } from "./components/DesktopOnlyGate";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <DesktopOnlyGate>
    <App />
  </DesktopOnlyGate>
);
