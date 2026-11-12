#!/usr/bin/env bash
# マイグレーション＋エリア投入＋施設テンプレート投入＋アプリ側の読み取り（mapper・判定）を往復で確認する
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DB_TEST_DB:-inu_db_test}"
HOST="${PGHOST:-localhost}"; USER_="${PGUSER:-postgres}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -U "$USER_" -h "$HOST")
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$f"; done
"${PSQL[@]}" -d "$DB" -f supabase/seed/areas_stations.sql
DATABASE_URL="postgresql://$USER_:${PGPASSWORD:-}@$HOST/$DB" npx tsx scripts/import-places.ts templates/places.template.csv --db
DATABASE_URL="postgresql://$USER_:${PGPASSWORD:-}@$HOST/$DB" npx tsx scripts/test-db-roundtrip.ts
"${PSQL[@]}" -d postgres -c "drop database if exists $DB"
