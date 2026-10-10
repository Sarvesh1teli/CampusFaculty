#!/usr/bin/env sh
set -eu
: "${BACKUP_PUBLIC_KEY:?Set age recipient public key}"
: "${BACKUP_DESTINATION:?Set off-VM destination user@host:/path}"
file="/tmp/campusfaculty-$(date -u +%Y%m%dT%H%M%SZ).sql.age"
trap 'rm -f "$file"' EXIT
docker compose exec -T db pg_dump -U campusfaculty_owner campusfaculty | age -r "$BACKUP_PUBLIC_KEY" > "$file"
scp "$file" "$BACKUP_DESTINATION"
