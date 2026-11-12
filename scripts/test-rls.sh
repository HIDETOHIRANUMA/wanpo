#!/usr/bin/env bash
# ローカルの PostgreSQL（16 で確認）に使い捨てDBを作り、Supabase互換スタブ＋マイグレーション＋RLSテストを流す。
# 実際の Supabase プロジェクトでの確認手順は README の「RLS の確認」を参照。
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${RLS_TEST_DB:-inu_rls_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
if [ -n "${PGURL:-}" ]; then ADMIN=("${PSQL[@]}" "$PGURL"); else ADMIN=("${PSQL[@]}" -U "${PGUSER:-postgres}" -h "${PGHOST:-localhost}"); fi
"${ADMIN[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { "${ADMIN[@]}" -d "$DB" -f "$1"; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/tests/rls.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
"${ADMIN[@]}" -d postgres -c "drop database if exists $DB"
