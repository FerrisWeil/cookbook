-- Optional explicit recipe facts. Existing rows stay unset.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS primary_protein TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS total_minutes INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS effort TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS meal_types TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_primary_protein_length;
ALTER TABLE recipes ADD CONSTRAINT recipes_primary_protein_length CHECK (
  primary_protein IS NULL
  OR char_length(btrim(primary_protein)) BETWEEN 1 AND 80
);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_total_minutes_range;
ALTER TABLE recipes ADD CONSTRAINT recipes_total_minutes_range CHECK (
  total_minutes IS NULL
  OR (
    total_minutes >= 0
    AND total_minutes <= 10080
  )
);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_effort_values;
ALTER TABLE recipes ADD CONSTRAINT recipes_effort_values CHECK (
  effort IS NULL OR effort IN ('low', 'medium', 'high')
);

ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_meal_types_values;
ALTER TABLE recipes ADD CONSTRAINT recipes_meal_types_values CHECK (
  meal_types <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'dessert']::TEXT[]
);
