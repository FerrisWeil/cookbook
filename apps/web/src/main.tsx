import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "@cookbook/ui/ui.css";
import "./screens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
