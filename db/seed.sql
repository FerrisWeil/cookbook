INSERT INTO app_meta (key, value)
VALUES ('seeded', 'true'), ('app', 'cookbook')
ON CONFLICT (key) DO NOTHING;
