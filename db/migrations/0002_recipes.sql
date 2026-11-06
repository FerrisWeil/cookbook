CREATE TABLE actors (
  name TEXT PRIMARY KEY
);

INSERT INTO actors (name) VALUES ('chef'), ('system'), ('taylor');

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  servings NUMERIC NOT NULL,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  rating SMALLINT,
  actor TEXT NOT NULL REFERENCES actors (name),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hidden_at TIMESTAMPTZ,
  hidden_by TEXT REFERENCES actors (name),
  CONSTRAINT recipes_title_present CHECK (title ~ '\S'),
  CONSTRAINT recipes_servings_positive CHECK (servings > 0),
  CONSTRAINT recipes_rating_range CHECK (
    rating IS NULL OR (rating >= 1 AND rating <= 5)
  ),
  CONSTRAINT recipes_hidden_pair CHECK (
    (hidden_at IS NULL) = (hidden_by IS NULL)
  )
);

CREATE TABLE recipe_ingredients (
  recipe_id TEXT NOT NULL REFERENCES recipes (id),
  position INTEGER NOT NULL,
  line TEXT NOT NULL,
  amount NUMERIC,
  unit TEXT,
  name TEXT,
  PRIMARY KEY (recipe_id, position),
  CONSTRAINT recipe_ingredients_position CHECK (position >= 0),
  CONSTRAINT recipe_ingredients_line_present CHECK (line ~ '\S')
);

CREATE TABLE recipe_steps (
  recipe_id TEXT NOT NULL REFERENCES recipes (id),
  position INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (recipe_id, position),
  CONSTRAINT recipe_steps_position CHECK (position >= 0)
);

CREATE TABLE recipe_nutrition (
  recipe_id TEXT PRIMARY KEY REFERENCES recipes (id),
  source TEXT NOT NULL,
  calories NUMERIC,
  protein NUMERIC,
  fat NUMERIC,
  carbs NUMERIC,
  CONSTRAINT recipe_nutrition_source CHECK (
    source IN ('estimated', 'entered', 'copied')
  )
);
