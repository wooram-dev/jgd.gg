#!/bin/sh
set -eu

# Runs only when the dedicated development volume is first initialized.
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres \
  --set=app_password="$JGD_DATABASE_PASSWORD" <<'SQL'
CREATE ROLE jgd LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE jgd OWNER jgd;
CREATE DATABASE jgd_test OWNER jgd;
SQL
