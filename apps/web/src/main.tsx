import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@cookbook/ui/ui.css";
import { PrototypeApp } from "./prototype/PrototypeControls";
import "./screens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element missing");
}

createRoot(root).render(
  <StrictMode>
    <PrototypeApp />
  </StrictMode>,
);
