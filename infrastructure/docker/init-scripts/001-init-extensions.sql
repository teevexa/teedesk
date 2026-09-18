-- Runs once, automatically, the first time the postgres container
-- initializes an empty data directory (see docker-entrypoint-initdb.d in
-- the official postgres image). Alembic migration 001 also creates this
-- extension, so this is defense-in-depth for anyone who provisions the
-- database a different way before ever running the app's migrations.
CREATE EXTENSION IF NOT EXISTS vector;
