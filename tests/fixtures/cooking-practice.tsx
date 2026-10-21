// Browser interaction fixture: same component as the authenticated Cooking page.
// This fixture is not an entry in the production build.
import React from "react";
import { createRoot } from "react-dom/client";
import { CookingPractice } from "../../src/features/cooking/CookingPractice";
import "../../src/index.css";

createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}><h1>Cooking practice</h1><CookingPractice /></main>,
);
