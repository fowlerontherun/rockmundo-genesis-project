import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { configureCharacterProfileAutofillProtection } from "./lib/characterProfileAutofillProtection";
import { configureStablePageLifecycle } from "./lib/pageLifecycle";
import "./index.css";

configureStablePageLifecycle();
configureCharacterProfileAutofillProtection();

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
