set -eu
cd /tmp/ubuntu/campus-faculty
cat > .deployment/verify-login.py <<'PY'
import json,urllib.request,http.cookiejar,pathlib
c=dict(line.split('=',1) for line in pathlib.Path('.deployment/admin-credentials.txt').read_text().splitlines())
o=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
r=o.open(urllib.request.Request(c['URL']+'api/auth/login',data=json.dumps({'email':c['EMAIL'],'password':c['PASSWORD']}).encode(),headers={'Content-Type':'application/json','Origin':'https://faculty.telicampus.in'}))
a=json.load(r)
assert a['user']['role']=='SUPER_ADMIN'
assert json.load(o.open(c['URL']+'api/auth/me'))['user']['email']==c['EMAIL']
assert isinstance(json.load(o.open(c['URL']+'api/admin/campaigns')),list)
print('HTTPS admin login, secure session, authenticated identity and campaigns API verified')
PY
python3 .deployment/verify-login.py
mkdir -p .deployment/backups
cat > .deployment/backup.sh <<'EOF'
#!/bin/bash
set -eu
cd /tmp/ubuntu/campus-faculty
set -a
. .deployment/migration.env
set +a
export PGOPTIONS='-c app.role=SYSTEM'
pg_dump --enable-row-security --format=custom --dbname="$DATABASE_URL" --file=".deployment/backups/campusfaculty-$(date -u +%Y%m%dT%H%M%SZ).dump"
chmod 600 .deployment/backups/*.dump
EOF
chmod 700 .deployment/backup.sh
bash .deployment/backup.sh
cat > .deployment/campusfaculty-backup.service <<'EOF'
[Unit]
Description=CampusFaculty database backup
[Service]
Type=oneshot
User=ubuntu
ExecStart=/bin/bash /tmp/ubuntu/campus-faculty/.deployment/backup.sh
UMask=0077
EOF
cat > .deployment/campusfaculty-backup.timer <<'EOF'
[Unit]
Description=Daily CampusFaculty database backup
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
[Install]
WantedBy=timers.target
EOF
sudo -n cp .deployment/campusfaculty-backup.service .deployment/campusfaculty-backup.timer /etc/systemd/system/
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now campusfaculty-backup.timer
pg_restore -l .deployment/backups/*.dump | tail -n 3
systemctl is-active campusfaculty-api campusfaculty-worker campusfaculty-backup.timer