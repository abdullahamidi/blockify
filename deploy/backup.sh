#!/usr/bin/env bash
# Sipariş verilerini (orders.json + fotoğraflar) yedekler, 30 günden eskileri siler.
# Kullanım: bash deploy/backup.sh [hedef_klasör]
set -euo pipefail
dest="${1:-/root/blockify-backups}"
mkdir -p "$dest"
name="blockify-$(date +%Y%m%d-%H%M%S).tgz"
docker run --rm --volumes-from blockify -v "$dest":/backup alpine tar czf "/backup/$name" -C /data .
find "$dest" -name 'blockify-*.tgz' -mtime +30 -delete
echo "$dest/$name"
