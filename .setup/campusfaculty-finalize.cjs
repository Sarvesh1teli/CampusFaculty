const fs=require('node:fs'),path=require('node:path');const root='C:\\git_project\\CampusFaculty';function write(n,s){const p=path.resolve(root,n);if(!p.startsWith(root+path.sep))throw Error('Bad target');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s.trimStart());}function edit(n,fn){write(n,fn(fs.readFileSync(path.join(root,n),'utf8')));}
edit('apps/api/src/integration.test.ts',s=>s.replace("manual UPI approval',async()=>{","manual UPI approval',{timeout:120000},async()=>{").replace('},{timeout:120000});','});'));
// Keep isolation SQL under migration history; avoid replaying ad-hoc SQL.
write('apps/api/prisma/migrations/20261008192000_tenant_isolation/migration.sql',fs.readFileSync(path.join(root,'apps/api/prisma/rls.sql'),'utf8'));
// Pipeline policies refer to the outer row explicitly to avoid ambiguous columns.
edit('apps/api/prisma/migrations/20261008192000_tenant_isolation/migration.sql',s=>s.replace('a.id="applicationId" AND a."tenantId"="Pipeline"."tenantId"','a.id="Pipeline"."applicationId" AND a."tenantId"="Pipeline"."tenantId"'));
// Candidate submission uses the legitimate application tenant for returning pipeline data.
edit('apps/api/src/main.ts',s=>s.replace("if(tenant.blocked||!c.active)throw new ForbiddenException('Application not permitted');","if(tenant.blocked||!c.active)throw new ForbiddenException('Application not permitted');").replace("const sub=await currentSub(u.tenantId);return {tenant:","const sub=await currentSub(u.tenantId);return {tenant:"));
// Audit invoice response uses raw response ownership; Nest otherwise tries to serialize Express response.
edit('apps/api/src/main.ts',s=>s.replace('Param,Query,UnauthorizedException','Param,Query,Res,UnauthorizedException').replace("async invoice(@Req()req:any,@Param('id')id:string)","async invoice(@Req()req:any,@Res()res:any,@Param('id')id:string)").replace("doc.pipe(req.res)","doc.pipe(res)").replace("return req.res;}\n @Post('auth/verification/start')","return;}\n @Post('auth/verification/start')"));
write('deploy/backup.sh',`
#!/usr/bin/env sh
set -eu
: "\${BACKUP_PUBLIC_KEY:?Set age recipient public key}"
: "\${BACKUP_DESTINATION:?Set off-VM destination user@host:/path}"
file="/tmp/campusfaculty-$(date -u +%Y%m%dT%H%M%SZ).sql.age"
trap 'rm -f "$file"' EXIT
docker compose exec -T db pg_dump -U campusfaculty campusfaculty | age -r "$BACKUP_PUBLIC_KEY" > "$file"
scp "$file" "$BACKUP_DESTINATION"
`);
write('deploy/nginx-https.example.conf',`
# Host Nginx; replace domain and provision certificates before enabling.
server { listen 80; server_name campusfaculty.example; return 301 https://$host$request_uri; }
server {
 listen 443 ssl;
 server_name campusfaculty.example;
 ssl_certificate /etc/letsencrypt/live/campusfaculty.example/fullchain.pem;
 ssl_certificate_key /etc/letsencrypt/live/campusfaculty.example/privkey.pem;
 ssl_protocols TLSv1.2 TLSv1.3;
 add_header Strict-Transport-Security "max-age=31536000" always;
 location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; }
}
`);
write('deploy/RUNBOOK.md',`
# Operations

Validate OCI capacity and ARM64 builds before deploying. Configure host Nginx HTTPS using nginx-https.example.conf; replace the example domain and use automated certificate renewal. Permit only 80/443 and tightly restricted SSH. Keep PostgreSQL and API private.

Use separate migration and non-superuser runtime database credentials. Apply Prisma migrations with the migration role. Grant the runtime role schema usage, table CRUD and sequence usage; it must not have SUPERUSER or BYPASSRLS. The API applies transaction-local authorization context through Prisma extensions. Do not grant direct database access to tenants.

Run npm run db:seed with strong owner credentials. Configure actual verification adapters and matching UPI/QR assets before enabling them. Give deployed QR files versioned names and never overwrite an asset referenced by pending payment requests.

Backup target: RPO 24 hours; initial RTO target 4 hours, subject to measured restore drills. Install age and configure deploy/backup.sh with a public recipient key and a separate host destination. Schedule daily, retain 7 daily/4 weekly/3 monthly backups on that destination, alert on failures, and test restores monthly in a separate database. Keep decryption keys outside the VM. Restore with age decryption piped into psql against an isolated target; verify counts, ledger reconciliation and health before directing traffic.

Monitor /api/health and database connectivity, host disk/CPU/memory, worker failures, verification failures and overdue Manual UPI requests. Keep logs free of passwords, OTPs, contact data and raw provider responses. Alert on failed backups, disk >80%, persistent HTTP 5xx and missed worker cycles. External alert provider configuration remains an operations task.

Before release back up the database, apply migrations with the owner role, build both apps and deploy immutable images. Roll back the application image if checks fail; schema rollback requires a reviewed forward fix or validated restore and must not silently delete financial records.

Invoice tax particulars, retention/erasure policies, provider delivery and production security review are launch gates. Never enable Manual UPI merely because a QR file exists. Verify the recipient, terms and actual receipt for each approval.
`);
console.log('Finalized migrations, tests and deployment runbook');
