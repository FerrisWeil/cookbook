CREATE TABLE cooking_sessions (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
  title TEXT NOT NULL,
  servings NUMERIC NOT NULL CHECK (servings > 0),
  ingredients JSONB NOT NULL,
  steps JSONB NOT NULL,
  displayed_step INTEGER NOT NULL CHECK (displayed_step >= 0),
  completed_steps INTEGER[] NOT NULL,
  CONSTRAINT cooking_sessions_title_present CHECK (title ~ '\S'),
  CONSTRAINT cooking_sessions_steps_present CHECK (jsonb_array_length(steps) > 0),
  CONSTRAINT cooking_sessions_display_in_range CHECK (
    displayed_step < jsonb_array_length(steps)
  )
);

CREATE UNIQUE INDEX cooking_sessions_one_active
  ON cooking_sessions (status)
  WHERE status = 'active';

CREATE TABLE session_mutation_acks (
  mutation_id TEXT PRIMARY KEY,
  payload_fingerprint TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES cooking_sessions (id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
