const fs=require('node:fs'),path=require('node:path');const root='C:\\git_project\\CampusFaculty';function write(n,s){const p=path.resolve(root,n);if(!p.startsWith(root+path.sep))throw Error('Bad target');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}function edit(n,fn){write(n,fn(fs.readFileSync(path.join(root,n),'utf8')));}
// Locks serialize each sensitive resource. Read committed refreshes the snapshot
// after a waiting lock, so completed consent withdrawal cannot be read as stale.
edit('apps/api/src/main.ts',s=>s.replace('Prisma.TransactionIsolationLevel.Serializable','Prisma.TransactionIsolationLevel.ReadCommitted').replace('tenantId: session?.user.tenantId || undefined,','tenantId: session && session.expiresAt > new Date() && session.user.active ? session.user.tenantId || undefined : undefined,').replace('candidateId: candidate?.id,','candidateId: session && session.expiresAt > new Date() && session.user.active ? candidate?.id : undefined,'));
write('apps/api/prisma/migrations/20261008195000_expired_context/migration.sql',`CREATE OR REPLACE FUNCTION app_private.tenant_access(t text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_private.privileged() OR (current_setting('app.role',true) IN ('TENANT_ADMIN','RECRUITER') AND t = nullif(current_setting('app.tenant',true),'')) $$;\n`);
edit('apps/api/src/integration.test.ts',s=>{const marker='      await request("teacher", "profile", "PATCH", {\n        ...fields,\n        active: false,\n      });';const insertion=`    let signal!:()=>void;const held=new Promise<void>(r=>signal=r);const withdrawing=db.$transaction(async t=>{await t.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text','candidate:'+profile.id);await t.candidate.update({where:{id:profile.id},data:{active:false}});signal();await new Promise(r=>setTimeout(r,300));});await held;await request('A','institution/candidates/'+profile.id+'/contact','GET',undefined,403);await withdrawing;
`;if(!s.includes(marker))throw Error('Consent test marker missing');return s.replace(marker,insertion+marker);});
edit('compose.yaml',s=>s.replace('    depends_on: { db: { condition: service_healthy } }\n  worker:',`    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on: { db: { condition: service_healthy } }
  worker:`));
console.log('Hardened consent locking and expired-session database context');
