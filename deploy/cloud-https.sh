set -eu
cd /tmp/ubuntu/campus-faculty
python3 - <<'PY'
from pathlib import Path
p=Path('.deployment/faculty.telicampus.in.conf')
s=p.read_text().replace(' listen 80;', ' listen 443 ssl;\n ssl_certificate /etc/letsencrypt/live/faculty.telicampus.in/fullchain.pem;\n ssl_certificate_key /etc/letsencrypt/live/faculty.telicampus.in/privkey.pem;\n ssl_protocols TLSv1.2 TLSv1.3;')
s+='\nserver {\n listen 80;\n server_name faculty.telicampus.in;\n root /var/www/campusfaculty;\n location /.well-known/acme-challenge/ { try_files $uri =404; }\n location / { return 301 https://$host$request_uri; }\n}\n'
p.write_text(s)
PY
sudo -n cp .deployment/faculty.telicampus.in.conf /etc/nginx/sites-available/faculty.telicampus.in.conf
sudo -n mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nnginx -t && systemctl reload nginx\n' > .deployment/campusfaculty-renew
sudo -n cp .deployment/campusfaculty-renew /etc/letsencrypt/renewal-hooks/deploy/campusfaculty-renew
sudo -n chmod 755 /etc/letsencrypt/renewal-hooks/deploy/campusfaculty-renew
sudo -n nginx -t
sudo -n systemctl reload nginx
systemctl is-active campusfaculty-api campusfaculty-worker buildsphere-backend school-uniform-order teachers-reg-api
curl -fsS https://faculty.telicampus.in/api/health
for path in / /teacher-registration; do curl -s -o /dev/null -w '%{http_code}\n' https://faculty.telicampus.in$path; done
for domain in jobs.telicampus.in garment.telicampus.in buildsphere.telicampus.in; do curl -s -o /dev/null -w "$domain %{http_code}\n" https://$domain; done
sha256sum /etc/nginx/sites-enabled/buildsphere.conf /etc/nginx/sites-enabled/garment.telicampus.in.conf /etc/nginx/sites-enabled/teachers-reg.conf
sudo -n journalctl -u campusfaculty-worker -n 5 --no-pager