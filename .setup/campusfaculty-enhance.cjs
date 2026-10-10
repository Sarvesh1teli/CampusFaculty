const fs=require('node:fs'),path=require('node:path');const root='C:\\git_project\\CampusFaculty';
function write(name,content){const p=path.resolve(root,name);if(!p.startsWith(root+path.sep))throw Error('Invalid target');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content.trimStart());}
function edit(name,fn){write(name,fn(fs.readFileSync(path.join(root,name),'utf8')));}
edit('apps/api/src/main.ts',s=>s.replace("await t.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',key)","await t.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text',key)"));
edit('apps/api/prisma/schema.prisma',s=>s.replace(' directoryConsent Boolean @default(false)',' directoryConsent Boolean @default(false)\n education Json @default("[]")\n experienceEntries Json @default("[]")\n skills Json @default("[]")\n subjects Json @default("[]")\n preferredLocations Json @default("[]")\n availability String @default("Not specified")\n noticeDays Int @default(0)').replace(' active Boolean @default(true)\n}\nmodel Subscription',' active Boolean @default(true)\n creditExpiryPolicy String @default("EXPIRE")\n carryForwardCap Int?\n}\nmodel Subscription').replace('model Session {','model VerificationChallenge {\n id String @id @default(cuid())\n userId String\n channel String\n destination String\n hash String\n expiresAt DateTime\n attempts Int @default(0)\n used Boolean @default(false)\n}\nmodel Session {').replace(' sessions Session[]',' emailVerified Boolean @default(false)\n mobileVerified Boolean @default(false)\n sessions Session[]'));
edit('apps/api/src/main.ts',s=>s.replace("import {z} from 'zod';","import {z} from 'zod';\nimport PDFDocument from 'pdfkit';\nimport {randomInt} from 'node:crypto';").replace("creditExpiryPolicy:'EXPIRE'","creditExpiryPolicy:p.creditExpiryPolicy||'EXPIRE',carryForwardCap:p.carryForwardCap??null").replace('active:z.boolean()}).parse(body);return tx(async t=>{const c=',`active:z.boolean(),education:z.array(z.object({degree:publicText,institution:publicText,year:z.number().int().min(1950).max(2100)})).optional(),experienceEntries:z.array(z.object({role:publicText,years:z.number().int().min(0).max(60)})).optional(),skills:z.array(publicText).max(30).optional(),subjects:z.array(publicText).max(30).optional(),preferredLocations:z.array(publicText).max(20).optional(),availability:publicText.optional(),noticeDays:z.number().int().min(0).max(365).optional()}).parse(body);return tx(async t=>{const c=`).replace('active:z.boolean()}).parse(body);return tx(async t=>{const p=','active:z.boolean(),creditExpiryPolicy:z.enum(["EXPIRE","CARRY_FORWARD"]).optional(),carryForwardCap:z.number().int().min(0).nullable().optional()}).parse(body);return tx(async t=>{const p='));
const endpoints=`
 @Get('institution/team') async team(@Req()req:any){const s=await actor(req,['TENANT_ADMIN']);return db.user.findMany({where:{tenantId:s.user.tenantId},select:{id:true,name:true,email:true,role:true,active:true}});}
 @Post('institution/team') async addRecruiter(@Req()req:any,@Body()body:any){const s=await actor(req,['TENANT_ADMIN']);const b=z.object({name:z.string().min(2).max(100),email:z.string().email(),password:z.string().min(12).max(128)}).parse(body);return tx(async t=>{const u=await t.user.create({data:{name:b.name,email:b.email.toLowerCase(),password:passwordHash(b.password),role:'RECRUITER',tenantId:s.user.tenantId}});await audit(t,s.user,'TEAM_MEMBER_ADDED',u.id);return {id:u.id};});}
 @Patch('institution/team/:id') async toggleRecruiter(@Req()req:any,@Param('id')id:string,@Body()body:any){const s=await actor(req,['TENANT_ADMIN']);const b=z.object({active:z.boolean()}).parse(body);return tx(async t=>{const result=await t.user.updateMany({where:{id,tenantId:s.user.tenantId,role:'RECRUITER'},data:b});if(!result.count)throw new NotFoundException();if(!b.active)await t.session.deleteMany({where:{userId:id}});await audit(t,s.user,'TEAM_MEMBER_STATUS',id,b);return {ok:true};});}
 @Get('admin/candidates') async moderateCandidates(@Req()req:any){await actor(req,['SUPER_ADMIN','PLATFORM_ADMIN']);const rows=await db.candidate.findMany({take:100,include:{user:{select:{name:true,email:true,emailVerified:true,mobileVerified:true,active:true}}}});return rows;}
 @Patch('admin/candidates/:id') async moderateCandidate(@Req()req:any,@Param('id')id:string,@Body()body:any){const s=await actor(req,['SUPER_ADMIN','PLATFORM_ADMIN']);const b=z.object({active:z.boolean()}).parse(body);return tx(async t=>{await lock(t,'candidate:'+id);const c=await t.candidate.update({where:{id},data:b});await t.user.update({where:{id:c.userId},data:{active:b.active}});if(!b.active)await t.session.deleteMany({where:{userId:c.userId}});await audit(t,s.user,'CANDIDATE_MODERATED',id,b);return {ok:true};});}
 @Get('institution/invoices/:id/pdf') async invoice(@Req()req:any,@Param('id')id:string){const u=await tenantActor(req);const i=await db.invoice.findFirst({where:{id,tenantId:u.tenantId}});if(!i)throw new NotFoundException();const payment=await db.paymentRequest.findUniqueOrThrow({where:{id:i.paymentId}});const tenant=await db.tenant.findUniqueOrThrow({where:{id:u.tenantId}});const doc=new PDFDocument({margin:50});req.res.setHeader('Content-Type','application/pdf');req.res.setHeader('Content-Disposition','attachment; filename="'+i.number+'.pdf"');doc.pipe(req.res);doc.fontSize(25).text('CampusFaculty');doc.moveDown().fontSize(16).text('Payment receipt / invoice');doc.fontSize(11).text('Reference: '+i.number).text('Issued: '+i.createdAt.toISOString().slice(0,10)).text('Institution: '+tenant.name).text('Plan: '+(payment.snapshot as any).name).text('Amount paid: INR '+(i.amount/100).toFixed(2)).text('Method: Manual UPI').moveDown().text('Tax treatment and statutory invoice particulars must be configured before production use.');doc.end();return req.res;}
 @Post('auth/verification/start') async startVerification(@Req()req:any,@Body()body:any){const s=await actor(req);const b=z.object({channel:z.enum(['EMAIL','SMS'])}).parse(body);const c=await db.candidate.findUnique({where:{userId:s.user.id}});const destination=b.channel==='EMAIL'?s.user.email:c?.mobile;if(!destination)throw new BadRequestException('Add a mobile number first');const recent=await db.verificationChallenge.findFirst({where:{userId:s.user.id,channel:b.channel,expiresAt:{gt:new Date(Date.now()+8*60000)}}});if(recent)throw new BadRequestException('Wait before requesting another code');const url=process.env[b.channel+'_VERIFICATION_URL'];const key=process.env[b.channel+'_VERIFICATION_KEY'];if(!url||!key)throw new BadRequestException('Verification provider not configured');const code=String(randomInt(100000,1000000));const challenge=await db.verificationChallenge.create({data:{userId:s.user.id,channel:b.channel,destination,hash:createHash('sha256').update(s.user.id+code).digest('hex'),expiresAt:new Date(Date.now()+10*60000)}});const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({destination,code,template:'campusfaculty-verification'}),signal:AbortSignal.timeout(10000)});if(!response.ok){await db.verificationChallenge.delete({where:{id:challenge.id}});throw new BadRequestException('Verification delivery failed');}return {challengeId:challenge.id};}
 @Post('auth/verification/confirm') async confirmVerification(@Req()req:any,@Body()body:any){const s=await actor(req);const b=z.object({challengeId:z.string(),code:z.string().regex(/^\\d{6}$/)}).parse(body);const result=await tx(async t=>{await lock(t,'verification:'+b.challengeId);const c=await t.verificationChallenge.findFirst({where:{id:b.challengeId,userId:s.user.id,used:false,expiresAt:{gt:new Date()},attempts:{lt:5}}});if(!c)return false;await t.verificationChallenge.update({where:{id:c.id},data:{attempts:{increment:1}}});if(c.hash!==createHash('sha256').update(s.user.id+b.code).digest('hex'))return false;const candidate=await t.candidate.findUnique({where:{userId:s.user.id}});if(c.channel==='SMS'&&candidate?.mobile!==c.destination)return false;await t.verificationChallenge.update({where:{id:c.id},data:{used:true}});await t.user.update({where:{id:s.user.id},data:c.channel==='EMAIL'?{emailVerified:true}:{mobileVerified:true}});return true;});if(!result)throw new BadRequestException('Invalid or expired code');return {ok:true};}
`;
edit('apps/api/src/main.ts',s=>s.replace(" @Get('notifications')",endpoints+"\n @Get('notifications')"));
edit('apps/api/package.json',s=>{const p=JSON.parse(s);p.dependencies.pdfkit='^0.17.2';p.devDependencies['@types/pdfkit']='^0.17.3';p.scripts.worker='tsx src/worker.ts';p.scripts['test:integration']='tsx --test src/integration.test.ts';return JSON.stringify(p,null,2);});
edit('apps/web/src/main.tsx',s=>s.replace("['Overview','Institutions','Payments','Plans','Settings','Audit']","['Overview','Institutions','Candidates','Payments','Plans','Settings','Audit']").replace("Candidates:Search","Candidates:Search").replace("if(admin)result=await api('admin/overview');","if(admin)result=page==='Candidates'?await api('admin/candidates'):await api('admin/overview');").replace("{page==='Candidates'&&<>","{page==='Candidates'&&!admin&&<>").replace("<Admin page={page}","<Admin page={page}").replace("function Admin({page,data,busy,superAdmin,action,setModal}:any){","function Admin({page,data,busy,superAdmin,action,setModal}:any){if(page==='Candidates')return <section className=\"list\">{data.map((c:Item)=><article className=\"card\" key={c.id}><h3>{c.displayId} · {c.user.name}</h3><p>{c.user.email} · {c.subject} · {c.user.emailVerified?'Email verified':'Email unverified'}</p><Button size=\"sm\" disabled={busy} variant=\"outline\" onClick={()=>action(()=>api('admin/candidates/'+c.id,'PATCH',{active:!c.user.active}))}>{c.user.active?'Block account':'Unblock account'}</Button></article>)}</section>;").replace("</div><h2 className=\"section-title\">Payments</h2>","</div><div className=\"card-actions\">{user.role==='TENANT_ADMIN'&&<Button variant=\"outline\" onClick={async()=>setModal({type:'team',team:await api('institution/team')})}>Manage team</Button>}</div><h2 className=\"section-title\">Invoices</h2><div className=\"card\">{data.invoices.map((i:Item)=><p key={i.id}><a className=\"text-blue-600\" href={'/api/institution/invoices/'+i.id+'/pdf'}>{i.number} · {rupees(i.amount)} · Download PDF</a></p>)}</div><h2 className=\"section-title\">Payments</h2>").replace("if(m.type==='reports')return",`if(m.type==='team')return <><h2>Institution team</h2>{m.team.map((u:Item)=><div className="plan-row" key={u.id}><div><h3>{u.name}</h3><p>{u.email} · {u.role}</p></div>{u.role==='RECRUITER'&&<Button size="sm" variant="outline" onClick={()=>action(()=>api('institution/team/'+u.id,'PATCH',{active:!u.active}))}>{u.active?'Deactivate':'Activate'}</Button>}</div>)}<form onSubmit={(e:any)=>{const v=form(e);action(()=>api('institution/team','POST',v),'Recruiter added');}}><h3>Add recruiter</h3><label>Name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Initial password<input name="password" type="password" minLength={12} required/></label><Button disabled={busy}>Add recruiter</Button></form></>;
if(m.type==='reports')return`).replace("<Button disabled={busy}>Save profile</Button>",`<details><summary>Education and teaching preferences</summary><label>Education JSON (degree, institution, year)<textarea name="educationJson" defaultValue={JSON.stringify(data.education,null,2)}/></label><label>Experience JSON (role, years)<textarea name="experienceJson" defaultValue={JSON.stringify(data.experienceEntries,null,2)}/></label><label>Skills (comma separated)<input name="skillsText" defaultValue={data.skills.join(', ')}/></label><label>Subjects / classes (comma separated)<input name="subjectsText" defaultValue={data.subjects.join(', ')}/></label><label>Preferred locations (comma separated)<input name="locationsText" defaultValue={data.preferredLocations.join(', ')}/></label><label>Availability<input name="availability" defaultValue={data.availability}/></label><label>Notice period (days)<input type="number" name="noticeDays" defaultValue={data.noticeDays} min="0"/></label></details><Button disabled={busy}>Save profile</Button>`).replace("{...v,experience:Number(v.experience),salary:Number(v.salary),active:v.active==='on'","{...v,education:JSON.parse(String(v.educationJson||'[]')),experienceEntries:JSON.parse(String(v.experienceJson||'[]')),skills:String(v.skillsText||'').split(',').map(s=>s.trim()).filter(Boolean),subjects:String(v.subjectsText||'').split(',').map(s=>s.trim()).filter(Boolean),preferredLocations:String(v.locationsText||'').split(',').map(s=>s.trim()).filter(Boolean),noticeDays:Number(v.noticeDays||0),experience:Number(v.experience),salary:Number(v.salary),active:v.active==='on'"));
write('apps/api/src/worker.ts',`
import 'dotenv/config';import {PrismaClient,Prisma} from '@prisma/client';const db=new PrismaClient();
async function tick(){const now=new Date();await db.session.deleteMany({where:{expiresAt:{lt:now}}});const grants=await db.creditGrant.findMany({where:{expiresAt:{lte:now},remaining:{gt:0}}});for(const grant of grants){try{await db.$transaction(async t=>{await t.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text','tenant:'+grant.tenantId);const g=await t.creditGrant.findUniqueOrThrow({where:{id:grant.id}});if(!g.remaining)return;const old=await t.subscription.findUniqueOrThrow({where:{id:g.subscriptionId}});const terms=old.snapshot as any;const next=await t.subscription.findFirst({where:{tenantId:g.tenantId,startsAt:{gte:old.endsAt,lte:now}},orderBy:{startsAt:'asc'}});if(terms.creditExpiryPolicy==='CARRY_FORWARD'&&!next)return;let carry=terms.creditExpiryPolicy==='CARRY_FORWARD'?Math.min(g.remaining,terms.carryForwardCap??g.remaining):0;await t.creditTransaction.create({data:{tenantId:g.tenantId,grantId:g.id,delta:-g.remaining,type:'EXPIRY',reference:'expiry:'+g.id,actorId:'SYSTEM'}});await t.creditGrant.update({where:{id:g.id},data:{remaining:0}});if(carry&&next){const ng=await t.creditGrant.create({data:{tenantId:g.tenantId,subscriptionId:next.id,amount:carry,remaining:carry,expiresAt:next.endsAt}});await t.creditTransaction.create({data:{tenantId:g.tenantId,grantId:ng.id,delta:carry,type:'CARRY_FORWARD',reference:'carry:'+g.id+':'+next.id,actorId:'SYSTEM'}});}}, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e:any){if(!['P2034','P2002'].includes(e.code))console.error('Grant processing failed',grant.id);}}
const subscriptions=await db.subscription.findMany({where:{startsAt:{lte:now},endsAt:{gte:new Date(now.getTime()-86400000),lte:new Date(now.getTime()+30*86400000)}}});for(const s of subscriptions){const days=Math.ceil((s.endsAt.getTime()-now.getTime())/86400000);if(![30,15,7,3,1,0].includes(days))continue;const reference='renewal:'+s.id+':'+days;await db.$transaction(async t=>{await t.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text',reference);if(await t.audit.findFirst({where:{entityId:reference,action:'RENEWAL_NOTICE'}}))return;const users=await t.user.findMany({where:{tenantId:s.tenantId,active:true}});await t.notification.createMany({data:users.map(u=>({userId:u.id,tenantId:s.tenantId,title:days===0?'Subscription expired':'Subscription ending soon',body:days===0?'Renew to post new jobs and unlock new contacts. Existing applications remain accessible.':'Your plan expires in '+days+' days.'}))});await t.audit.create({data:{actorId:'SYSTEM',tenantId:s.tenantId,entityId:reference,action:'RENEWAL_NOTICE',details:{days}}});});}}
let running=false;async function run(){if(running)return;running=true;try{await tick();}catch{console.error('Worker cycle failed');}finally{running=false;}}run();setInterval(run,60000);process.on('SIGINT',()=>db.$disconnect().then(()=>process.exit()));
`);
write('deploy/nginx.conf',`
server {
 listen 80;
 server_name _;
 root /usr/share/nginx/html;
 index index.html;
 location /api/ { proxy_pass http://api:3001; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; add_header Cache-Control "no-store" always; }
 location / { try_files $uri $uri/ /index.html; }
 location ~* \\.(?:js|css|svg|woff2)$ { add_header Cache-Control "public, max-age=3600"; }
 add_header X-Content-Type-Options nosniff;
 add_header Referrer-Policy strict-origin-when-cross-origin;
 client_max_body_size 128k;
}
`);
write('apps/api/Dockerfile',`FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run db:generate && npm run build -w apps/api
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
`);
write('apps/web/Dockerfile',`FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
RUN npm run build -w apps/web
FROM nginx:stable-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
`);
write('compose.yaml',`
services:
 db:
  image: postgres:16-alpine
  restart: unless-stopped
  environment:
   POSTGRES_DB: campusfaculty
   POSTGRES_USER: campusfaculty
   POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}
  volumes: ["postgres-data:/var/lib/postgresql/data"]
  healthcheck:
   test: ["CMD-SHELL", "pg_isready -U campusfaculty"]
   interval: 10s
   timeout: 5s
   retries: 5
 api:
  build: {context: ., dockerfile: apps/api/Dockerfile}
  restart: unless-stopped
  environment: &api-env
   DATABASE_URL: postgresql://campusfaculty:\${POSTGRES_PASSWORD}@db:5432/campusfaculty
   NODE_ENV: production
   API_HOST: 0.0.0.0
   PORT: 3001
   WEB_ORIGIN: \${WEB_ORIGIN:?Set HTTPS origin}
  depends_on: {db: {condition: service_healthy}}
 worker:
  build: {context: ., dockerfile: apps/api/Dockerfile}
  command: ["node", "dist/worker.js"]
  restart: unless-stopped
  environment: *api-env
  depends_on: {db: {condition: service_healthy}}
 web:
  build: {context: ., dockerfile: apps/web/Dockerfile}
  restart: unless-stopped
  ports: ["127.0.0.1:8080:80"]
  depends_on: [api]
volumes:
 postgres-data:
`);
edit('apps/api/src/main.ts',s=>s.replace("'127.0.0.1');}","process.env.API_HOST||'127.0.0.1');}"));
write('.dockerignore','node_modules\n**/node_modules\n**/dist\n**/.env\n.local\n.git\n');
write('README.md',`
# CampusFaculty

Standalone React/TypeScript/Vite PWA and NestJS/Prisma/PostgreSQL application. Requirements are in REQUIREMENTS.md. Manual UPI is the default; no Razorpay credentials are required.

## Local development

Node 22.17+ and PostgreSQL 16+. Run npm install, copy apps/api/.env.example to apps/api/.env and set DATABASE_URL and a strong SEED_ADMIN_PASSWORD. From the root run npm run db:generate, npm run db:migrate -- --name initial, npm run db:seed, then npm run dev:api and npm run dev:web in separate terminals. Run npm run worker -w apps/api for expiry and renewal notifications. Open http://localhost:5173.

An isolated local PostgreSQL instance may be available in .local/postgres on port 55432. This is separate from any existing school ERP database. Local owner credentials are in apps/api/.env and must not be committed.

Register teachers and institutions through the UI. Sign in as the seeded owner to verify institutions. Collections are disabled until a real UPI ID, payee and matching deployment QR are configured. Put the QR in apps/web/public/assets/upi-qr.png, then configure /assets/upi-qr.png under Super Admin Settings. Do not enable collections without verifying the destination and bank/app suitability. No candidate file upload routes exist.

Schools select a plan under Account, pay externally, submit the reference, and await receipt verification. Approvals allocate credits atomically. Pending UTRs do not grant entitlements. Never use unverified references to approve payments.

## Verification providers

Set EMAIL_VERIFICATION_URL/KEY and SMS_VERIFICATION_URL/KEY to your own HTTPS provider adapter. The adapter receives POST JSON {destination,code,template} with Bearer authentication. Codes expire in 10 minutes with five attempts. No codes or secrets are returned to clients. Provider setup and real delivery verification remain required before public launch.

## Tests

npm test runs policy checks; npm run build compiles both apps. Integration tests require a dedicated empty test database and exercise payment idempotency, consent and tenant isolation. Do not run destructive test setup against production.

## Deployment

Compose runs a private PostgreSQL service, API, worker and Nginx frontend on localhost:8080. Set POSTGRES_PASSWORD and WEB_ORIGIN in an untracked root .env. Run migrations and seed deliberately before traffic. Terminate HTTPS with host Nginx and automated certificate renewal; do not expose the internal API or PostgreSQL publicly. Container images target standard Linux and must be validated on the selected OCI ARM64 shape.

Production launch requires off-VM encrypted backups/restore testing, legal retention/invoice configuration, verification providers, TLS, monitoring and tenant-isolation review. The generated invoice is currently a payment receipt with an explicit tax-configuration notice, not a finalized statutory tax invoice.
`);
console.log('Applied enhancements and deployment files');
