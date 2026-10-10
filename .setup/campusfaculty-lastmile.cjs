const fs=require('node:fs'),path=require('node:path');const root='C:\\git_project\\CampusFaculty';function write(n,s){const p=path.resolve(root,n);if(!p.startsWith(root+path.sep))throw Error('Bad path');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}function edit(n,fn){write(n,fn(fs.readFileSync(path.join(root,n),'utf8')));}
edit('apps/web/src/main.tsx',s=>s.replace('          <Modal\n', '          {error && <div className="alert error" role="alert">{error}</div>}\n          <Modal\n').replace('<nav className="bottom-nav">','<nav className={"bottom-nav" + (admin ? " admin-nav" : "")}>'));
edit('apps/web/src/styles.css',s=>s+'\n@media(max-width:760px){.bottom-nav.admin-nav{overflow-x:auto;justify-content:flex-start;gap:18px}.bottom-nav.admin-nav button{flex-shrink:0}}\n');
edit('compose.yaml',s=>s.replace('      MIGRATION_DATABASE_URL: ${MIGRATION_DATABASE_URL:?Set migration owner URL}\n','').replace('  api:\n',`  migrate:
    profiles: ["tools"]
    build: { context: ., dockerfile: apps/api/Dockerfile }
    command: ["node", "../../node_modules/prisma/build/index.js", "migrate", "deploy"]
    environment:
      DATABASE_URL: \${MIGRATION_DATABASE_URL:?Set migration owner URL}
      MIGRATION_DATABASE_URL: \${MIGRATION_DATABASE_URL:?Set migration owner URL}
    depends_on: { db: { condition: service_healthy } }
  api:
`));
// Profile and application consent changes always leave an audit record.
edit('apps/api/src/main.ts',s=>{const start=s.indexOf('  async candidateApplication('),end=s.indexOf('@Get("institution/candidates")',start);if(start<0||end<0)throw Error('Missing application method');let part=s.slice(start,end);part=part.replace('      await notifyTenant(', '      await audit(t,s.user,"APPLICATION_PRIVACY_UPDATED",id,{contactConsent:b.contactConsent??a.contactConsent,withdraw:!!b.withdraw});\n      await notifyTenant(');return s.slice(0,start)+part+s.slice(end);});
edit('scripts/browser-check.cjs',s=>s.replace("await page.screenshot({path:'.local/screenshots/admin-desktop.png',fullPage:true});", "await page.screenshot({path:'.local/screenshots/admin-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Admin mobile page must not overflow');await page.screenshot({path:'.local/screenshots/admin-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});"));
edit('README.md',s=>s+'\nUse docker compose --profile tools run --rm migrate for production migrations. Migration owner credentials belong only to that one-off service, not the running API/worker.\n');
console.log('Finished modal feedback, admin mobile layout and migration credential separation');
