#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/phase1plus-init.log) 2>&1

echo "=== Phase 1+ server bootstrap starting ==="

# ── System update ──────────────────────────────────────────────────────────────
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git wget unzip nginx certbot python3-certbot-nginx ufw htop

# ── Docker ────────────────────────────────────────────────────────────────────
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
systemctl enable docker
systemctl start docker

# Docker Compose v2
DOCKER_COMPOSE_VERSION="2.28.1"
curl -SL "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# ── Node.js 20 ────────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pnpm@9

# ── Application directory ─────────────────────────────────────────────────────
mkdir -p /opt/phase1plus
chown ubuntu:ubuntu /opt/phase1plus

# Docker Compose for PostgreSQL + Redis (local services)
cat > /opt/phase1plus/docker-compose.yml << 'COMPOSE'
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    container_name: phase1plus_pg
    restart: always
    environment:
      POSTGRES_DB: phase1plus
      POSTGRES_USER: phase1plus
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    container_name: phase1plus_redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD:-changeme}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  pg_data:
  redis_data:
COMPOSE

chown ubuntu:ubuntu /opt/phase1plus/docker-compose.yml

# Start PostgreSQL + Redis
cd /opt/phase1plus && docker-compose up -d

# ── nginx reverse proxy ───────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/phase1plus << 'NGINX'
server {
    listen 80;
    server_name _;

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass             http://127.0.0.1:3000;
        proxy_http_version     1.1;
        proxy_set_header       Host              $host;
        proxy_set_header       X-Real-IP         $remote_addr;
        proxy_set_header       X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header       X-Forwarded-Proto $scheme;
        proxy_read_timeout     60s;
        proxy_connect_timeout  10s;
        client_max_body_size   10M;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/phase1plus /etc/nginx/sites-enabled/phase1plus
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl restart nginx

# ── Firewall ──────────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "=== Phase 1+ server bootstrap complete ==="
