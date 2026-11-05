#!/usr/bin/env bash
# Blockify'ı bir Ubuntu/Debian sunucuya (ör. Contabo VPS) kurar ya da kurulumu yeniler.
#
# Kullanım (sunucuda, root olarak):
#   git clone https://github.com/abdullahamidi/blockify.git /opt/blockify
#   cd /opt/blockify
#   DOMAIN=figur.ornek.com EMAIL=sen@ornek.com bash deploy/setup.sh
#
# Ne yapar:
#   1. Docker yoksa kurar, .env dosyasını (rastgele yönetici anahtarıyla) oluşturur
#   2. Uygulamayı Docker ile derleyip başlatır (yalnızca 127.0.0.1:8787)
#   3. nginx yoksa kurar, alan adı için site ayarı ekler (mevcut sitelere dokunmaz)
#   4. DNS sunucuyu gösteriyorsa Let's Encrypt SSL sertifikası alır
#   5. Günlük veri yedeği için cron görevi ekler
#
# Seçenekler (ortam değişkeni):
#   DOMAIN     (zorunlu) sitenin adresi, ör. figur.ornek.com
#   EMAIL      SSL bildirimleri ve sitede görünen iletişim adresi
#   FORCE_SSL=1  DNS kontrolünü atla (Cloudflare proxy kullanıyorsanız)
#   SKIP_SSL=1   SSL adımını atla
set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
FORCE_SSL="${FORCE_SSL:-0}"
SKIP_SSL="${SKIP_SSL:-0}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*"; }
die() {
  printf '\033[1;31mHATA: %s\033[0m\n' "$*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || die "Root olarak çalıştırın (sudo -i)."
[ -n "$DOMAIN" ] || die "DOMAIN verin. Örnek: DOMAIN=figur.ornek.com EMAIL=sen@ornek.com bash deploy/setup.sh"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "Geçersiz alan adı: $DOMAIN"
if [ -n "$EMAIL" ] && ! [[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+$ ]]; then die "Geçersiz e-posta: $EMAIL"; fi
command -v apt-get >/dev/null || die "Bu betik Ubuntu/Debian içindir."
cd "$APP_DIR"

# ---------------------------------------------------------------- paketler
log "Gerekli paketler"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates openssl dnsutils iproute2 >/dev/null

if ! command -v docker >/dev/null; then
  log "Docker kuruluyor"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || die "docker compose eklentisi bulunamadı."

# ---------------------------------------------------------------- .env
if [ ! -f .env ]; then
  log ".env oluşturuluyor"
  cp .env.example .env
  sed -i "s/^ADMIN_TOKEN=.*/ADMIN_TOKEN=$(openssl rand -hex 24)/" .env
  sed -i "s/^TRUST_PROXY=.*/TRUST_PROXY=1/" .env
  if [ -n "$EMAIL" ]; then sed -i "s/^CONTACT_EMAIL=.*/CONTACT_EMAIL=$EMAIL/" .env; fi
else
  log ".env zaten var, olduğu gibi kullanılıyor"
fi
chmod 600 .env

# ---------------------------------------------------------------- uygulama
log "Uygulama derleniyor ve başlatılıyor (ilk seferde birkaç dakika sürebilir)"
docker compose up -d --build
for _ in $(seq 1 45); do
  curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1 || die "Uygulama açılmadı. Kayıtlar: docker compose logs blockify"
echo "Uygulama çalışıyor: http://127.0.0.1:8787"

# ---------------------------------------------------------------- yedek
cat >/etc/cron.d/blockify-backup <<EOF
# Blockify sipariş verilerinin günlük yedeği (30 gün saklanır)
30 3 * * * root $APP_DIR/deploy/backup.sh >/dev/null 2>&1
EOF
chmod +x "$APP_DIR/deploy/backup.sh" "$APP_DIR/deploy/update.sh"

# ---------------------------------------------------------------- nginx
port80="$(ss -ltnpH 'sport = :80' 2>/dev/null || true)"
if [ -n "$port80" ] && ! grep -q nginx <<<"$port80"; then
  warn "80 portunu nginx dışında bir program kullanıyor:"
  echo "$port80"
  proxy_ctr="$(docker ps --filter publish=80 --format '{{.Names}}' | head -n1)"
  if [ -n "$proxy_ctr" ]; then
    proxy_img="$(docker inspect -f '{{.Config.Image}}' "$proxy_ctr")"
    proxy_nets="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$proxy_ctr")"
    warn "Bu bir Docker ters vekili: $proxy_ctr ($proxy_img), ağ(lar): $proxy_nets"
    cat <<EOF2

Blockify'ı bu vekilin ağına bağlamak için:
  echo "PROXY_NETWORK=${proxy_nets%% *}" >> $APP_DIR/.env
  echo "COMPOSE_FILE=docker-compose.yml:deploy/compose.proxy.yml" >> $APP_DIR/.env
  cd $APP_DIR && docker compose up -d

Sonra vekilde $DOMAIN için yönlendirme ekleyin: http://blockify:8787
(Ayrıntılar: README, "Sunucuda başka bir Docker vekili varsa")
EOF2
  else
    warn "Ters vekili o programda elle ayarlayın: $DOMAIN -> http://127.0.0.1:8787 (örnek: deploy/nginx-blockify.conf)"
  fi
  exit 0
fi

if ! command -v nginx >/dev/null; then
  log "nginx kuruluyor"
  apt-get install -y -qq nginx >/dev/null
fi

if [ -d /etc/nginx/sites-available ]; then
  conf=/etc/nginx/sites-available/blockify.conf
  link=/etc/nginx/sites-enabled/blockify.conf
else
  conf=/etc/nginx/conf.d/blockify.conf
  link=""
fi
if [ ! -f "$conf" ]; then
  log "nginx site ayarı: $DOMAIN"
  sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx-blockify.conf >"$conf"
  if [ -n "$link" ]; then ln -sf "$conf" "$link"; fi
else
  log "nginx ayarı zaten var ($conf), değiştirilmedi"
fi
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx 2>/dev/null || systemctl restart nginx

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null || true
fi

# ---------------------------------------------------------------- SSL
scheme=http
if [ "$SKIP_SSL" = 1 ]; then
  warn "SSL adımı atlandı."
else
  public_ip="$(curl -fsS4 --max-time 10 https://api.ipify.org || true)"
  dns_ip="$(dig +short A "$DOMAIN" | grep -E '^[0-9.]+$' | tail -n1 || true)"
  if [ "$FORCE_SSL" != 1 ] && { [ -z "$dns_ip" ] || [ "$dns_ip" != "$public_ip" ]; }; then
    warn "DNS henüz bu sunucuyu göstermiyor: $DOMAIN -> '${dns_ip:-kayıt yok}', sunucu IP: ${public_ip:-bilinmiyor}"
    warn "Alan adınızın DNS ayarlarına '$DOMAIN' için A kaydı ekleyin (değer: ${public_ip:-sunucu IP}), sonra betiği tekrar çalıştırın."
  else
    log "SSL sertifikası alınıyor"
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
    if [ -n "$EMAIL" ]; then email_args=(-m "$EMAIL"); else email_args=(--register-unsafely-without-email); fi
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --keep-until-expiring "${email_args[@]}"
    scheme=https
  fi
fi

# ---------------------------------------------------------------- özet
token="$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2-)"
cat <<EOF

$(printf '\033[1;32m')Kurulum tamam.$(printf '\033[0m')

  Site:            $scheme://$DOMAIN
  Yönetim paneli:  $scheme://$DOMAIN/admin
  Yönetici anahtarı: $token

  Güncelleme:  bash $APP_DIR/deploy/update.sh
  Kayıtlar:    docker compose -f $APP_DIR/docker-compose.yml logs -f
  Yedek:       her gece 03:30'da /root/blockify-backups altına (elle: bash $APP_DIR/deploy/backup.sh)
  Ayarlar:     $APP_DIR/.env (değiştirince: docker compose up -d)
EOF
