import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { createBrowserCooking } from "./cooking/browser";
import { createBrowserSession } from "./kitchen-runtime";
import "@cookbook/ui/ui.css";
import "./screens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element missing");
}

const session = createBrowserSession();
const cooking = createBrowserCooking();

createRoot(root).render(
  <StrictMode>
    <App session={session} cooking={cooking} />
  </StrictMode>,
);
