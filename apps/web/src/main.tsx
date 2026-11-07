import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { createBrowserSession } from "./kitchen-runtime";
import "@cookbook/ui/ui.css";
import "./screens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element missing");
}

const session = createBrowserSession();

createRoot(root).render(
  <StrictMode>
    <App session={session} />
  </StrictMode>,
);
