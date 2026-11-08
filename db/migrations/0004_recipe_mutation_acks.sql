CREATE TABLE recipe_mutation_acks (
  mutation_id TEXT PRIMARY KEY,
  payload_fingerprint TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX recipe_mutation_acks_recipe_id_idx
  ON recipe_mutation_acks (recipe_id);
