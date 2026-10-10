set -eu
cd /tmp/ubuntu/campus-faculty
[ "$(pwd -P)" = /tmp/ubuntu/campus-faculty ]
mkdir -p .deployment
chmod 700 .deployment
python3 - <<'PY'
import secrets, pathlib
p=pathlib.Path('.deployment')
owner=secrets.token_hex(32); runtime=secrets.token_hex(32); admin=secrets.token_hex(24)
(p/'create.sql').write_text("CREATE ROLE campusfaculty_owner LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '"+owner+"';\nCREATE ROLE campusfaculty_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '"+runtime+"';\nCREATE DATABASE campusfaculty_db OWNER campusfaculty_owner;\nREVOKE ALL ON DATABASE campusfaculty_db FROM PUBLIC;\nGRANT CONNECT ON DATABASE campusfaculty_db TO campusfaculty_runtime;\n")
(p/'migration.env').write_text('DATABASE_URL=postgresql://campusfaculty_owner:'+owner+'@127.0.0.1:5432/campusfaculty_db\nMIGRATION_DATABASE_URL=postgresql://campusfaculty_owner:'+owner+'@127.0.0.1:5432/campusfaculty_db\nSEED_ADMIN_EMAIL=owner@faculty.telicampus.in\nSEED_ADMIN_PASSWORD='+admin+'\n')
(p/'runtime.env').write_text('DATABASE_URL=postgresql://campusfaculty_runtime:'+runtime+'@127.0.0.1:5432/campusfaculty_db\nMIGRATION_DATABASE_URL=postgresql://campusfaculty_runtime:'+runtime+'@127.0.0.1:5432/campusfaculty_db\nPORT=3005\nAPI_HOST=127.0.0.1\nWEB_ORIGIN=https://faculty.telicampus.in\nNODE_ENV=production\n')
(p/'admin-credentials.txt').write_text('URL=https://faculty.telicampus.in/\nEMAIL=owner@faculty.telicampus.in\nPASSWORD='+admin+'\n')
for f in p.iterdir(): f.chmod(0o600)
PY
sudo -n -u postgres psql -v ON_ERROR_STOP=1 < .deployment/create.sql
set -a
. .deployment/migration.env
set +a
node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
sudo -n -u postgres psql -d campusfaculty_db -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public, app_private TO campusfaculty_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO campusfaculty_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO campusfaculty_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE campusfaculty_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO campusfaculty_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE campusfaculty_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO campusfaculty_runtime;
SQL
export DATABASE_URL="${DATABASE_URL}?options=-c%20app.role%3DSYSTEM"
npm run db:seed -w apps/api
chmod 600 .deployment/*.env .deployment/admin-credentials.txt
printf 'CampusFaculty database and seed complete. Credentials stored privately.\n'
