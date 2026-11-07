import type { RecipeFacts } from "@cookbook/shared";
import { useEffect, useState } from "react";

import { FACTS_SAVE_ERROR, updateRecipeFacts } from "./api";
import {
  draftFromFacts,
  type FactsDraft,
  type FactsFormStatus,
} from "./facts";

export type RecipeFactsEditor = {
  editing: boolean;
  draft: FactsDraft | null;
  status: FactsFormStatus;
  open: () => void;
  cancel: () => void;
  changeDraft: (draft: FactsDraft) => void;
  save: (next: RecipeFacts) => Promise<void>;
};

export function useRecipeFactsEditor({
  recipeId,
  facts,
  revision,
  onCommitted,
}: {
  recipeId: string;
  facts: RecipeFacts | null;
  revision?: number;
  onCommitted: (facts: RecipeFacts) => void;
}): RecipeFactsEditor {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FactsDraft | null>(null);
  const [status, setStatus] = useState<FactsFormStatus>({ kind: "idle" });

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setStatus({ kind: "idle" });
  }, [recipeId, revision]);

  function open() {
    if (!facts || status.kind === "submitting") {
      return;
    }
    setDraft(draftFromFacts(facts));
    setStatus({ kind: "idle" });
    setEditing(true);
  }

  function cancel() {
    if (status.kind === "submitting") {
      return;
    }
    setEditing(false);
    setDraft(null);
    setStatus({ kind: "idle" });
  }

  async function save(next: RecipeFacts) {
    if (status.kind === "submitting") {
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const saved = await updateRecipeFacts(recipeId, next);
      setEditing(false);
      setDraft(null);
      setStatus({ kind: "idle" });
      onCommitted(saved);
    } catch {
      setStatus({ kind: "error", message: FACTS_SAVE_ERROR });
    }
  }

  return {
    editing,
    draft,
    status,
    open,
    cancel,
    changeDraft: setDraft,
    save,
  };
}
