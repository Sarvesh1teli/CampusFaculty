set -eu
cd /tmp/ubuntu/campus-faculty
sudo -n mkdir -p /var/www/campusfaculty
sudo -n cp -a apps/web/dist/. /var/www/campusfaculty/
for service in api worker; do
entry=main
[ "$service" = api ] || entry=worker
cat > .deployment/campusfaculty-$service.service <<EOF
[Unit]
Description=CampusFaculty $service
After=network.target postgresql.service
[Service]
Type=simple
User=ubuntu
WorkingDirectory=/tmp/ubuntu/campus-faculty/apps/api
EnvironmentFile=/tmp/ubuntu/campus-faculty/.deployment/runtime.env
ExecStart=/usr/bin/node /tmp/ubuntu/campus-faculty/apps/api/dist/$entry.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
UMask=0077
[Install]
WantedBy=multi-user.target
EOF
sudo -n cp .deployment/campusfaculty-$service.service /etc/systemd/system/
done
cat > .deployment/faculty.telicampus.in.conf <<'EOF'
server {
 listen 80;
 server_name faculty.telicampus.in;
 root /var/www/campusfaculty;
 index index.html;
 location /.well-known/acme-challenge/ { try_files $uri =404; }
 location /api/ {
  proxy_pass http://127.0.0.1:3005;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  add_header Cache-Control "no-store" always;
 }
 location / { try_files $uri $uri/ /index.html; }
 client_max_body_size 128k;
 add_header X-Content-Type-Options nosniff always;
 add_header Referrer-Policy strict-origin-when-cross-origin always;
}
EOF
sudo -n cp .deployment/faculty.telicampus.in.conf /etc/nginx/sites-available/faculty.telicampus.in.conf
sudo -n ln -s /etc/nginx/sites-available/faculty.telicampus.in.conf /etc/nginx/sites-enabled/faculty.telicampus.in.conf
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now campusfaculty-api campusfaculty-worker
sudo -n nginx -t
sudo -n systemctl reload nginx
curl -fsS http://127.0.0.1:3005/api/health
sudo -n certbot certonly --webroot -w /var/www/campusfaculty -d faculty.telicampus.in --non-interactive --agree-tos --register-unsafely-without-email