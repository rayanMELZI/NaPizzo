#!/usr/bin/env bash
# Production deploy on the pilot VM: sync code to /opt/napizzo (data/ is kept), install unit + vhost, restart.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=/opt/napizzo

npm test
sudo mkdir -p "$DEST"
sudo rsync -a --delete --exclude data --exclude .git --exclude dist --exclude node_modules ./ "$DEST/"
sudo mkdir -p "$DEST/data"
sudo chown -R pilot: "$DEST"

sudo install -m 644 deploy/napizzo.service /etc/systemd/system/napizzo.service
sudo install -m 644 deploy/nginx-napizzo.conf /etc/nginx/sites-available/napizzo.conf
sudo ln -sf /etc/nginx/sites-available/napizzo.conf /etc/nginx/sites-enabled/napizzo.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --quiet napizzo
sudo systemctl restart napizzo
sudo systemctl reload nginx

for i in $(seq 1 20); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then echo "napizzo is up"; exit 0; fi
  sleep 0.5
done
echo "napizzo did not answer on :3000" >&2
sudo journalctl -u napizzo -n 30 --no-pager >&2
exit 1
