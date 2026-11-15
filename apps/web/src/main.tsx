import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { createBrowserCooking } from "./cooking/browser";
import { createBrowserSession } from "./kitchen-runtime";
import { createPrototypeCooking } from "./prototype/cooking";
import { createPrototypeKitchen } from "./prototype/kitchen";
import { isSampleDataMode } from "./prototype/mode";
import { PrototypeRuntimeProvider } from "./prototype/runtime";
import "@cookbook/ui/ui.css";
import "./screens.css";
import "./prototype/cooking.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element missing");
}

if (isSampleDataMode()) {
  const kitchen = createPrototypeKitchen();
  const cooking = createPrototypeCooking();
  createRoot(root).render(
    <StrictMode>
      <PrototypeRuntimeProvider
        kitchen={kitchen}
        cooking={cooking.prototypeStore}
      >
        <App session={kitchen} cooking={cooking} />
      </PrototypeRuntimeProvider>
    </StrictMode>,
  );
} else {
  createRoot(root).render(
    <StrictMode>
      <App session={createBrowserSession()} cooking={createBrowserCooking()} />
    </StrictMode>,
  );
}
