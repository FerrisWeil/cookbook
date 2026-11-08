import type { RecipeFacts } from "@cookbook/shared";
import { useEffect, useState } from "react";

import { FACTS_SAVE_ERROR } from "./api";
import {
  draftFromFacts,
  type FactsDraft,
  type FactsFormStatus,
} from "./facts";
import type { FieldPatch, JsonValue } from "./sync/types";

export type RecipeFactsEditor = {
  editing: boolean;
  draft: FactsDraft | null;
  baseline: RecipeFacts | null;
  status: FactsFormStatus;
  open: () => void;
  cancel: () => void;
  changeDraft: (draft: FactsDraft) => void;
  save: (fields: Partial<RecipeFacts>) => Promise<void>;
};

function asPatch(fields: Partial<RecipeFacts>): FieldPatch {
  const patch: { [key: string]: JsonValue } = {};
  if ("primaryProtein" in fields) {
    patch.primaryProtein = fields.primaryProtein ?? null;
  }
  if ("totalMinutes" in fields) {
    patch.totalMinutes = fields.totalMinutes ?? null;
  }
  if ("effort" in fields) {
    patch.effort = fields.effort ?? null;
  }
  if ("mealTypes" in fields) {
    patch.mealTypes = [...(fields.mealTypes ?? [])];
  }
  return patch;
}

export async function submitFactsFields(
  saveFields: (recipeId: string, fields: FieldPatch) => Promise<void>,
  recipeId: string,
  fields: Partial<RecipeFacts>,
): Promise<"empty" | "queued"> {
  const patch = asPatch(fields);
  if (Object.keys(patch).length === 0) {
    return "empty";
  }
  await saveFields(recipeId, patch);
  return "queued";
}

export type FactsEditorState = {
  editing: boolean;
  draft: FactsDraft | null;
  baseline: RecipeFacts | null;
  status: FactsFormStatus;
};

export function createFactsEditor({
  recipeId,
  saveFields,
}: {
  recipeId: string;
  saveFields: (recipeId: string, fields: FieldPatch) => Promise<void>;
}) {
  let currentId = recipeId;
  let facts: RecipeFacts | null = null;
  let state: FactsEditorState = {
    editing: false,
    draft: null,
    baseline: null,
    status: { kind: "idle" },
  };
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setState(next: FactsEditorState): void {
    state = next;
    emit();
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState(): FactsEditorState {
      return state;
    },
    setFacts(next: RecipeFacts | null): void {
      facts = next;
    },
    setRecipeId(next: string): void {
      if (currentId === next) {
        return;
      }
      currentId = next;
      setState({
        editing: false,
        draft: null,
        baseline: null,
        status: { kind: "idle" },
      });
    },
    open(): void {
      if (!facts || state.status.kind === "submitting") {
        return;
      }
      setState({
        editing: true,
        draft: draftFromFacts(facts),
        baseline: facts,
        status: { kind: "idle" },
      });
    },
    cancel(): void {
      if (state.status.kind === "submitting") {
        return;
      }
      setState({
        editing: false,
        draft: null,
        baseline: null,
        status: { kind: "idle" },
      });
    },
    changeDraft(draft: FactsDraft): void {
      setState({ ...state, draft });
    },
    async save(fields: Partial<RecipeFacts>): Promise<void> {
      if (state.status.kind === "submitting") {
        return;
      }
      setState({ ...state, status: { kind: "submitting" } });
      try {
        await submitFactsFields(saveFields, currentId, fields);
        setState({
          editing: false,
          draft: null,
          baseline: null,
          status: { kind: "idle" },
        });
      } catch {
        setState({
          ...state,
          status: { kind: "error", message: FACTS_SAVE_ERROR },
        });
      }
    },
  };
}

export function useRecipeFactsEditor({
  recipeId,
  facts,
  saveFields,
}: {
  recipeId: string;
  facts: RecipeFacts | null;
  saveFields: (recipeId: string, fields: FieldPatch) => Promise<void>;
}): RecipeFactsEditor {
  const [editor] = useState(() => createFactsEditor({ recipeId, saveFields }));
  const [, setTick] = useState(0);
  useEffect(
    () => editor.subscribe(() => setTick((value) => value + 1)),
    [editor],
  );
  useEffect(() => {
    editor.setFacts(facts);
  }, [editor, facts]);
  useEffect(() => {
    editor.setRecipeId(recipeId);
  }, [editor, recipeId]);
  editor.setFacts(facts);
  const state = editor.getState();
  return {
    editing: state.editing,
    draft: state.draft,
    baseline: state.baseline,
    status: state.status,
    open: () => editor.open(),
    cancel: () => editor.cancel(),
    changeDraft: (draft) => editor.changeDraft(draft),
    save: (fields) => editor.save(fields),
  };
}
