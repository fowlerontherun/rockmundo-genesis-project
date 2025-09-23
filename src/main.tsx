import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/setup-auth-error-handlers";

createRoot(document.getElementById("root")!).render(<App />);
