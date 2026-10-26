#!/bin/sh
# Runs once, on an empty data directory, as the image superuser.
# The Postgres image has sh, not bash.
# cookbook_migrator owns the database and applies DDL.
# cookbook_app is the request role and cannot create objects.
set -eu

reject() {
  echo "$1 is a placeholder or the old shared dev password" >&2
  exit 1
}

check_password() {
  name="$1"
  value="$2"
  compact=$(printf '%s' "$value" | tr -d '[:space:]')
  if [ -z "$compact" ] || [ "$value" = "replace-me" ] || [ "$value" = "cookbook" ]; then
    reject "$name"
  fi
}

check_password POSTGRES_MIGRATOR_PASSWORD "${POSTGRES_MIGRATOR_PASSWORD:-}"
check_password POSTGRES_APP_PASSWORD "${POSTGRES_APP_PASSWORD:-}"
check_password POSTGRES_PASSWORD "${POSTGRES_PASSWORD:-}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v migrator_password="$POSTGRES_MIGRATOR_PASSWORD" \
  -v app_password="$POSTGRES_APP_PASSWORD" \
  -v dbname="$POSTGRES_DB" <<'EOF'
CREATE ROLE cookbook_migrator
  LOGIN
  PASSWORD :'migrator_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE;

CREATE ROLE cookbook_app
  LOGIN
  PASSWORD :'app_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE;

REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO cookbook_migrator;
GRANT CONNECT ON DATABASE :"dbname" TO cookbook_app;
ALTER DATABASE :"dbname" OWNER TO cookbook_migrator;

GRANT USAGE ON SCHEMA public TO cookbook_app;

SET ROLE cookbook_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cookbook_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO cookbook_app;
RESET ROLE;
EOF
