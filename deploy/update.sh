#!/usr/bin/env bash
# Sunucuda en son kodu çekip uygulamayı yeniden derler ve başlatır.
# Kullanım: bash deploy/update.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1 && { echo "Güncellendi ve çalışıyor."; exit 0; }
  sleep 2
done
echo "Uygulama açılmadı. Kayıtlar: docker compose logs blockify" >&2
exit 1
