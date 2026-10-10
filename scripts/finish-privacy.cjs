const fs=require('node:fs'),path=require('node:path');const root=process.cwd();if(root.toLowerCase()!=='c:\\git_project\\campusfaculty')throw Error('Wrong workspace');
function write(n,s){const p=path.resolve(root,n);if(!p.startsWith(root+path.sep))throw Error('Outside project');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);}function edit(n,fn){write(n,fn(fs.readFileSync(path.join(root,n),'utf8')));}
edit('apps/api/prisma/schema.prisma',s=>s.replace(' profileReviewed Boolean @default(false)',' profileReviewed Boolean @default(false)\n revision Int @default(1)'));
write('apps/api/prisma/migrations/20261008203000_review_revision/migration.sql','ALTER TABLE "Candidate" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;\n');
edit('apps/api/src/policy.test.ts',s=>s.replace('displayId: "TC1",','displayId: "TC1",\n      profileReviewed: true,'));
edit('apps/api/src/main.ts',s=>s.replace('data: {...b,profileReviewed:false},','data: {...b,profileReviewed:false,revision:{increment:1}},'));
edit('apps/api/src/main.ts',s=>{const start=s.indexOf('@Patch("admin/candidates/:id")'),end=s.indexOf('@Get("institution/invoices',start);if(start<0||end<0)throw Error('Moderator not found');const method=`@Patch("admin/candidates/:id") async moderateCandidate(@Req() req:any,@Param("id") id:string,@Body() body:any){
 const s=await actor(req,["SUPER_ADMIN","PLATFORM_ADMIN"]);const b=z.object({active:z.boolean().optional(),profileReviewed:z.boolean().optional(),revision:z.number().int().optional()}).parse(body);
 return tx(async t=>{await lock(t,"candidate:"+id);const c=await t.candidate.findUniqueOrThrow({where:{id}});if(b.profileReviewed && b.revision!==c.revision)throw new BadRequestException("The profile changed. Refresh before approving.");
 await t.candidate.update({where:{id},data:{profileReviewed:b.profileReviewed,...(b.active===false?{active:false}:{})}});
 if(b.active!==undefined){await t.user.update({where:{id:c.userId},data:{active:b.active}});if(!b.active)await t.session.deleteMany({where:{userId:c.userId}});}
 await audit(t,s.user,"CANDIDATE_MODERATED",id,b);return {ok:true};});
 }
 `;return s.slice(0,start)+method+s.slice(end);});
edit('apps/web/src/main.tsx',s=>s.replace('{active:c.user.active,profileReviewed:true}','{profileReviewed:true,revision:c.revision}'));
edit('apps/api/src/integration.test.ts',s=>s.replace("await request('owner','admin/candidates/'+profile.id,'PATCH',{active:true,profileReviewed:true});",`const reviewProfile=await request('teacher','profile');await request('owner','admin/candidates/'+profile.id,'PATCH',{profileReviewed:true,revision:reviewProfile.revision});`));
edit('apps/api/src/integration.test.ts',s=>s.replace('      const reviewProfile=',`      const reviewProfile=`).replace("const reviewProfile=await request('teacher','profile');await request",`const reviewProfile=await request('teacher','profile');await request('owner','admin/candidates/'+profile.id,'PATCH',{profileReviewed:true,revision:reviewProfile.revision-1},400);await request`));
edit('scripts/browser-check.cjs',s=>s.replace("await page.screenshot({path:'.local/screenshots/admin-desktop.png',fullPage:true});", "await page.screenshot({path:'.local/screenshots/admin-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Admin mobile page must not overflow');await page.screenshot({path:'.local/screenshots/admin-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});"));
write('.npmrc','cache=.local/npm-cache\n');
console.log('Updated only CampusFaculty files: safe versioned review and tests');
