import { createContext, useContext, type ReactNode } from "react";

import type { PrototypeCookingStore } from "./cooking";
import type { PrototypeKitchen } from "./kitchen";

export type PrototypeRuntime = {
  kitchen: PrototypeKitchen;
  cooking: PrototypeCookingStore;
};

const PrototypeRuntimeContext = createContext<PrototypeRuntime | null>(null);

export function PrototypeRuntimeProvider({
  kitchen,
  cooking,
  children,
}: {
  kitchen: PrototypeKitchen;
  cooking: PrototypeCookingStore;
  children: ReactNode;
}) {
  return (
    <PrototypeRuntimeContext.Provider value={{ kitchen, cooking }}>
      {children}
    </PrototypeRuntimeContext.Provider>
  );
}

export function usePrototypeRuntime(): PrototypeRuntime | null {
  return useContext(PrototypeRuntimeContext);
}

export function usePrototypeCooking(): PrototypeCookingStore | null {
  return useContext(PrototypeRuntimeContext)?.cooking ?? null;
}
