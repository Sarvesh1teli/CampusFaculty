import { pricing, defaultPricing, requireFee, createOrder } from "./commerce";
import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Body,
  Param,
  Query,
  Res,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { randomInt } from "node:crypto";
import {
  anonymous,
  canReapply,
  contactAllowed,
  renewalStart,
  terminalStatuses,
} from "./policy";
import { db, base, scope, setScope } from "./database";
const moneyPlan = (p: any) => ({
  name: p.name,
  amount: p.amount,
  currency: "INR",
  days: p.days,
  credits: p.credits,
  jobLimit: p.jobLimit,
  searchLimit: p.searchLimit,
  creditExpiryPolicy: p.creditExpiryPolicy || "EXPIRE",
  carryForwardCap: p.carryForwardCap ?? null,
});
const publicText = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (v) => !/@|https?:|www\.|\b\d[\d\s+-]{7,}\d\b/i.test(v),
    "Do not include contact information",
  );
function passwordHash(p: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
function passwordMatches(p: string, h: string) {
  const [salt, hash] = h.split(":");
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === 64 && timingSafeEqual(scryptSync(p, salt, 64), expected)
  );
}
async function tx<T>(
  fn: (t: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await base.$transaction(
        async (t) => {
          await setScope(t);
          return fn(t);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (e: any) {
      if (!["P2034", "P2002"].includes(e.code) || n >= 12) throw e;
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 30));
    }
  }
}
async function lock(t: Prisma.TransactionClient, key: string) {
  await t.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))::text",
    key,
  );
}
async function actor(req: any, roles?: string[]) {
  const session = await db.session.findUnique({
    where: {
      id: createHash("sha256")
        .update(req.cookies?.cf_session || "")
        .digest("hex"),
    },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active)
    throw new UnauthorizedException("Please sign in");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers["x-csrf-token"] !== session.csrf
  )
    throw new ForbiddenException("Invalid CSRF token");
  if (roles && !roles.includes(session.user.role))
    throw new ForbiddenException("Permission denied");
  if (session.user.tenantId) {
    const tenant = await db.tenant.findUnique({
      where: { id: session.user.tenantId },
    });
    if (!tenant || tenant.blocked)
      throw new ForbiddenException("Institution access blocked");
  }
  return session;
}
async function tenantActor(req: any) {
  const s = await actor(req, ["TENANT_ADMIN", "RECRUITER"]);
  if (!s.user.tenantId) throw new ForbiddenException();
  return s.user as typeof s.user & { tenantId: string };
}
async function flag(key: string, t: any = db) {
  const setting = await t.setting.findUnique({ where: { key } });
  if (setting?.value !== true) throw new ForbiddenException("FEATURE_DISABLED");
}
async function currentSub(tenantId: string, t: any = db) {
  const now = new Date();
  return t.subscription.findFirst({
    where: { tenantId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
  });
}
function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number){const rad=Math.PI/180,a=Math.sin((lat2-lat1)*rad/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}
async function audit(
  t: any,
  u: any,
  action: string,
  id: string,
  details: any = {},
) {
  await t.audit.create({
    data: {
      actorId: u.id,
      tenantId: u.tenantId,
      action,
      entityId: id,
      details: Object.fromEntries(Object.entries(details||{}).filter(([key])=>!/password|otp|aadhaar|token|secret|mobile|email|address/i.test(key))),
    },
  });
}
async function notifyTenant(
  t: any,
  tenantId: string,
  title: string,
  body: string,
) {
  const users = await t.user.findMany({
    where: { tenantId, active: true },
    select: { id: true },
  });
  await t.notification.createMany({
    data: users.map((u: any) => ({ userId: u.id, tenantId, title, body })),
  });
}
async function hasActivePlan(tenantId: string, t: any) {
  if ((await pricing(t))?.enabled) return true;
  await t.$queryRawUnsafe("SELECT set_config('app.role','SYSTEM',true)");
  try {
    return !!(await currentSub(tenantId, t));
  } finally {
    await setScope(t);
  }
}

@Controller("api")
class Api {
  @Post("admin/commerce/:id/refund") async recordRefund(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const a = await actor(req, ["SUPER_ADMIN"]);
    const b = z
      .object({
        reference: z.string().trim().min(6).max(100),
        reason: z.string().trim().min(5).max(500),
        confirmedReimbursed: z.literal(true),
      })
      .parse(body);
    return tx(async (t) => {
      const initial = await t.commerceOrder.findUniqueOrThrow({
        where: { id },
      });
      await lock(
        t,
        "fee:" + (initial.kind === "JOB" ? initial.tenantId : initial.userId),
      );
      await lock(t, "commerce:" + id);
      const o = await t.commerceOrder.findUniqueOrThrow({ where: { id } });
      if (o.status === "REFUNDED") return { alreadyRefunded: true };
      if (o.status !== "APPROVED" || o.consumedAt || o.kind === "UNLOCK_PACK")
        throw new BadRequestException(
          "Only unused approved feature fees can be refunded",
        );
      await audit(t, a.user, "EXTERNAL_REFUND_RECORDED", id, {
        amount: o.amount,
        reference: b.reference,
        reason: b.reason,
      });
      return t.commerceOrder.update({
        where: { id },
        data: {
          status: "REFUNDED",
          reason: "External refund " + b.reference + ": " + b.reason,
        },
      });
    });
  }
  @Get("commerce/config") async commerceConfig(@Req() req: any) {
    await actor(req);
    const cfg = (await pricing(db)) || defaultPricing;
    const a = await actor(req);
    return {
      ...cfg,
      creditValidity: a.user.tenantId ? await db.creditGrant.findMany({where:{tenantId:a.user.tenantId,remaining:{gt:0},expiresAt:{gt:new Date()}},select:{expiresAt:true,remaining:true},orderBy:{expiresAt:"asc"}}) : [],
      profileActivated:
        (
          await db.setting.findUnique({
            where: { key: "profile-activation:" + a.user.id },
          })
        )?.value === true,
    };
  }
  @Get("commerce/orders") async commerceOrders(@Req() req: any) {
    const s = await actor(req);
    const where =
      s.user.role === "SUPER_ADMIN"
        ? {}
        : s.user.tenantId
          ? { tenantId: s.user.tenantId }
          : { userId: s.user.id };
    const orders=await db.commerceOrder.findMany({ where, orderBy: { createdAt: "desc" } });
    if(s.user.role !== "SUPER_ADMIN") return orders;
    const [tenants,users]=await Promise.all([db.tenant.findMany({where:{id:{in:orders.map(o=>o.tenantId).filter((id):id is string=>!!id)}},select:{id:true,name:true}}),db.user.findMany({where:{id:{in:orders.map(o=>o.userId)}},select:{id:true,name:true}})]);
    return orders.map(o=>({...o,customerName:tenants.find(t=>t.id===o.tenantId)?.name || users.find(u=>u.id===o.userId)?.name || o.tenantId || o.userId}));
  }
  @Post("commerce/orders") async commerceCreate(
    @Req() req: any,
    @Body() body: any,
  ) {
    const s = await actor(req, ["CANDIDATE", "TENANT_ADMIN", "RECRUITER"]);
    const b = z
      .object({
        kind: z.enum(["PROFILE", "APPLICATION", "JOB", "UNLOCK_PACK"]),
        quantity: z.number().int().min(1).max(100).default(1),
        target: z.string().max(200).default(""),
      })
      .parse(body);
    if (b.kind !== "UNLOCK_PACK" && b.quantity !== 1)
      throw new BadRequestException("Feature fees are purchased one at a time");
    return tx((t) => createOrder(t, s.user, b.kind, b.quantity, b.target));
  }
  @Post("commerce/orders/:id/submit") async commerceSubmit(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req);
    const b = z
      .object({
        utr: z.string().trim().min(6).max(100),
        amount: z.number().int().positive(),
      })
      .parse(body);
    return tx(async (t) => {
      await lock(t, "commerce:" + id);
      const o = await t.commerceOrder.findFirst({
        where: {
          id,
          ...(s.user.tenantId
            ? { tenantId: s.user.tenantId }
            : { userId: s.user.id }),
        },
      });
      if (!o) throw new NotFoundException();
      if (o.status !== "AWAITING_PAYMENT" || o.amount !== b.amount)
        throw new BadRequestException(
          "Quote changed or payment already submitted. Refresh before paying.",
        );
      return t.commerceOrder.update({
        where: { id },
        data: { utr: b.utr.toUpperCase(), status: "UNDER_REVIEW" },
      });
    });
  }
  @Patch("admin/commerce/:id/discount") async commerceDiscount(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN"]);
    const b = z
      .object({
        discount: z.number().int().min(0),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(body);
    return tx(async (t) => {
      await lock(t, "commerce:" + id);
      const o = await t.commerceOrder.findUniqueOrThrow({ where: { id } });
      if (o.status !== "AWAITING_PAYMENT" || b.discount >= o.subtotal)
        throw new BadRequestException(
          "Discount requires an unpaid order and positive final amount",
        );
      const changed = await t.commerceOrder.update({
        where: { id },
        data: {
          discount: b.discount,
          amount: o.subtotal - b.discount,
          reason: b.reason,
        },
      });
      await audit(t, s.user, "PURCHASE_DISCOUNT", id, {
        discount: b.discount,
        reason: b.reason,
      });
      return changed;
    });
  }
  @Post("admin/commerce/:id/decision") async commerceDecision(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN"]);
    const b = z
      .object({
        approve: z.boolean(),
        receiptReference: z.string().trim().min(6).max(100).optional(),
        receivedAmount: z.number().int().positive().optional(),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(body);
    return tx(async (t) => {
      await lock(t, "commerce:" + id);
      const o = await t.commerceOrder.findUniqueOrThrow({ where: { id } });
      if (o.status === "APPROVED") return { alreadyApproved: true };
      if (o.status !== "UNDER_REVIEW")
        throw new BadRequestException("Payment is not under review");
      if (!b.approve) {
        await audit(t, s.user, "PURCHASE_REJECTED", id, { reason: b.reason });
        return t.commerceOrder.update({
          where: { id },
          data: { status: "REJECTED", reason: b.reason },
        });
      }
      if (b.receivedAmount !== o.amount || !b.receiptReference)
        throw new BadRequestException(
          "Verify the actual receipt and exact amount",
        );
      const receiptKey =
        (o.payeeSnapshot as any).upiId.toLowerCase() +
        ":" +
        b.receiptReference.toUpperCase();
      await lock(t, "receipt:" + receiptKey);
      if (
        (await t.commerceOrder.findUnique({ where: { receiptKey } })) ||
        (await t.paymentRequest.findUnique({ where: { receiptKey } }))
      )
        throw new BadRequestException("Receipt already used");
      const terms = o.snapshot as any;
      if (o.kind === "UNLOCK_PACK") {
        await lock(t, "tenant:" + o.tenantId);
        const g = await t.creditGrant.create({
          data: {
            tenantId: o.tenantId!,
            subscriptionId: "pack:" + o.id,
            amount: terms.credits,
            remaining: terms.credits,
            expiresAt: new Date(Date.now() + terms.validityDays * 86400000),
          },
        });
        await t.creditTransaction.create({
          data: {
            tenantId: o.tenantId!,
            grantId: g.id,
            delta: terms.credits,
            type: "PACK_ALLOCATION",
            reference: o.id,
            actorId: s.user.id,
          },
        });
      }
      await audit(t, s.user, "PURCHASE_APPROVED", id, {
        amount: o.amount,
        receiptKey,
      });
      await t.notification.create({
        data: {
          userId: o.userId,
          tenantId: o.tenantId,
          title: "Payment approved",
          body:
            o.kind === "UNLOCK_PACK"
              ? terms.credits + " unlock credits added."
              : "Your " +
                o.kind.toLowerCase() +
                " payment is approved. Return to the feature to continue.",
        },
      });
      return t.commerceOrder.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          receiptKey,
          reason: b.reason,
        },
      });
    });
  }

  @Get("features") async features() {
    const keys = [
      "institution_job_posting_enabled",
      "candidate_job_search_enabled",
      "candidate_job_applications_enabled",
      "institution_candidate_search_enabled",
      "institution_candidate_unlock_enabled",
    ];
    const settings = await db.setting.findMany({
      where: { key: { in: keys } },
    });
    return Object.fromEntries(
      keys.map((key) => [
        key,
        settings.find((s) => s.key === key)?.value !== false,
      ]),
    );
  }

  @Get("health") async health() {
    await db.$queryRawUnsafe("SELECT 1");
    return { status: "ok", name: "CampusFaculty" };
  }
  @Post("auth/register") async register(@Body() body: any, @Req() req: any) {
    const b = z
      .object({
        email: z
          .string()
          .email()
          .transform((v) => v.toLowerCase()),
        password: z.string().min(8).max(128),
        name: z.string().min(2).max(100),
        campaign:z.string().trim().max(40).optional(),
        registrationMobile:z.string().regex(/^[0-9]{10}$/).optional(),
        profession:z.enum(["TEACHER","PHARMACIST"]).default("TEACHER"),
        recruitingProfessions:z.array(z.enum(["TEACHER","PHARMACIST"])).min(1).max(2).optional(),
        role: z.enum(["CANDIDATE", "TENANT_ADMIN"]),
        institution: z.preprocess(
          (v) => (v === "" ? undefined : v),
          z.string().min(2).max(150).optional(),
        ),
      })
      .parse(body);
    if (b.role === "TENANT_ADMIN" && !b.institution)
      throw new BadRequestException("Institution name required");
    await scope.run({ role: "SYSTEM" }, () =>
      tx(async (t) => {
        if(b.campaign){if(b.role!=="CANDIDATE")throw new BadRequestException("Candidate campaign only");await lock(t,"campaign:"+b.campaign.toUpperCase());const c=(await t.setting.findUnique({where:{key:"campaign:"+b.campaign.toUpperCase()}}))?.value as any;if(!c?.active)throw new BadRequestException("Campaign unavailable");}if(await t.user.findUnique({where:{email:b.email}}))throw new BadRequestException("An account already exists. Sign in to continue.");
        if(b.registrationMobile&&await t.candidate.findFirst({where:{mobile:b.registrationMobile}}))throw new BadRequestException("Mobile already registered. Sign in to the existing account.");
        const tenant =
          b.role === "TENANT_ADMIN"
            ? await t.tenant.create({ data: { name: b.institution!,recruitingProfessions:b.recruitingProfessions||["TEACHER"] } })
            : null;
        const u = await t.user.create({
          data: {
            email: b.email,
            password: passwordHash(b.password),
            name: b.name,
            role: b.role,
            tenantId: tenant?.id,
          },
        });
        if (b.role === "CANDIDATE")
          await t.candidate.create({
            data: {
              userId: u.id,
              profession:b.profession,
              displayId: (b.profession==="PHARMACIST"?"PH":"TC") + randomBytes(5).toString("hex").toUpperCase(),
              subject: "Not specified",
              qualification: "Not specified",
              location: "Not specified",
              mobile:b.registrationMobile||"",
            },
          });
        await audit(t,u,"ACCOUNT_CREATED",u.id,{accountType:u.role,campaign:b.campaign||null});
        if(b.campaign)await t.setting.create({data:{key:"campaign-source:"+u.id,value:{code:b.campaign.toUpperCase(),userId:u.id,createdAt:new Date().toISOString()}}});
        if (tenant && !(await pricing(t))?.enabled) {
          const p = await t.plan.findUnique({ where: { id: "free" } });
          if (!p) throw new BadRequestException("Platform setup incomplete");
          const startsAt = new Date(),
            endsAt = new Date(Date.now() + p.days * 86400000);
          const s = await t.subscription.create({
            data: {
              tenantId: tenant.id,
              planId: p.id,
              snapshot: moneyPlan(p),
              startsAt,
              endsAt,
            },
          });
          const g = await t.creditGrant.create({
            data: {
              tenantId: tenant.id,
              subscriptionId: s.id,
              amount: p.credits,
              remaining: p.credits,
              expiresAt: endsAt,
            },
          });
          await t.creditTransaction.create({
            data: {
              tenantId: tenant.id,
              grantId: g.id,
              delta: p.credits,
              type: "PLAN_ALLOCATION",
              reference: s.id,
              actorId: u.id,
            },
          });
        }
      }),
    );
    return this.login({ email: b.email, password: b.password }, req);
  }
  @Get("places") async places(@Query("q") q="",@Query("ids") ids=""){
    if(ids){const keys=ids.split(",").slice(0,20);return db.geoPlace.findMany({where:{id:{in:keys}}});}
    const term=q.trim().slice(0,80);if(term.length<2)return [];
    const exact=await db.geoPlace.findMany({where:{OR:[{name:{equals:term,mode:"insensitive"}},{aliases:{startsWith:term+",",mode:"insensitive"}},{aliases:{contains:","+term+",",mode:"insensitive"}},{aliases:{endsWith:","+term,mode:"insensitive"}}]},take:5});const more=await db.geoPlace.findMany({where:{id:{notIn:exact.map(p=>p.id)},OR:[{name:{contains:term,mode:"insensitive"}},{aliases:{contains:term,mode:"insensitive"}}]},orderBy:{name:"asc"},take:20-exact.length});return [...exact,...more];
  }
  @Get("public/campaigns/:code") async publicCampaign(@Param("code") code:string){const row=await db.setting.findUnique({where:{key:"campaign:"+code.toUpperCase()}});const c=row?.value as any;if(!c?.active)throw new NotFoundException("Campaign unavailable");return {name:c.name,code:c.code};}
  @Get("admin/campaigns") async campaigns(@Req() req:any){await actor(req,["SUPER_ADMIN"]);const rows=await db.setting.findMany({where:{key:{startsWith:"campaign:"}}});const sources=await db.setting.findMany({where:{key:{startsWith:"campaign-source:"}}});return Promise.all(rows.map(async row=>{const c=row.value as any;const ids=sources.filter(v=>(v.value as any).code===c.code).map(v=>(v.value as any).userId);const candidates=await db.candidate.findMany({where:{userId:{in:ids}},select:{id:true,userId:true}});const activated=await db.setting.count({where:{key:{in:ids.map(id=>"profile-activation:"+id)},value:{equals:true}}});const pipelines=await db.pipeline.findMany({where:{candidateId:{in:candidates.map(v=>v.id)}}});return {...c,accounts:ids.length,registered:activated,shortlisted:new Set(pipelines.filter(v=>["SHORTLISTED","INTERVIEW","SELECTED","JOINED"].includes(v.stage)).map(v=>v.candidateId)).size,selected:new Set(pipelines.filter(v=>["SELECTED","JOINED"].includes(v.stage)).map(v=>v.candidateId)).size};}));}
  @Post("admin/campaigns") async createCampaign(@Req() req:any,@Body() body:any){const u=(await actor(req,["SUPER_ADMIN"])).user;const b=z.object({name:z.string().trim().min(3).max(120),code:z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9-]+$/)}).parse(body);return tx(async t=>{const code=b.code.toUpperCase();await lock(t,"campaign:"+code);if(await t.setting.findUnique({where:{key:"campaign:"+code}}))throw new BadRequestException("Campaign code already exists");const value={...b,code,active:true,createdAt:new Date().toISOString()};await t.setting.create({data:{key:"campaign:"+code,value}});await audit(t,u,"CAMPAIGN_CREATED",code);return value;});}
  @Patch("admin/campaigns/:code") async changeCampaign(@Req() req:any,@Param("code") code:string,@Body() body:any){const u=(await actor(req,["SUPER_ADMIN"])).user;const b=z.object({active:z.boolean()}).parse(body);return tx(async t=>{await lock(t,"campaign:"+code);const row=await t.setting.findUniqueOrThrow({where:{key:"campaign:"+code}});const value={...(row.value as any),active:b.active};await t.setting.update({where:{key:row.key},data:{value}});await audit(t,u,"CAMPAIGN_STATUS_CHANGED",code,b);return value;});}
  @Post("auth/login") async login(@Body() body: any, @Req() req: any) {
    const b = z
      .object({ email: z.string().email(), password: z.string().max(128) })
      .parse(body);
    const u = await db.user.findUnique({
      where: { email: b.email.toLowerCase() },
    });
    if (!u || !u.active || !passwordMatches(b.password, u.password)) {
      await audit(db,u||{id:"UNKNOWN"},"AUTH_LOGIN_FAILED",u?.id||"UNKNOWN",{reason:!u?"Account not found":!u.active?"Account inactive":"Incorrect password"});
      throw new UnauthorizedException("Invalid credentials");
    }
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    await db.session.create({
      data: {
        id: createHash("sha256").update(token).digest("hex"),
        userId: u.id,
        csrf,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await audit(db,u,"AUTH_LOGIN",u.id);
    req.res.cookie("cf_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400000,
      path: "/",
    });
    return {
      user: { id: u.id, name: u.name, role: u.role, email: u.email },
      csrf,
    };
  }
  @Get("auth/me") async me(@Req() req: any) {
    const s = await actor(req);
    return {
      user: {
        id: s.user.id,
        name: s.user.name,
        role: s.user.role,
        email: s.user.email,
      },
      csrf: s.csrf,
    };
  }
  @Post("auth/logout") async logout(@Req() req: any) {
    const s = await actor(req);
    await audit(db,s.user,"AUTH_LOGOUT",s.user.id);
    await db.session.delete({ where: { id: s.id } });
    req.res.clearCookie("cf_session", { path: "/" });
    return { ok: true };
  }
  @Get("profile") async profile(@Req() req: any) {
    const s = await actor(req, ["CANDIDATE"]);
    return db.candidate.findUnique({ where: { userId: s.user.id } });
  }
  @Patch("profile") async editProfile(@Req() req: any, @Body() body: any) {
    const s = await actor(req, ["CANDIDATE"]);
    const b = z
      .object({
        subject: publicText,
        qualification: publicText,
        location: publicText,
        experience: z.number().int().min(0).max(60),
        salary: z.number().int().min(0).max(10000000),
        mobile: z.string().max(20),
        personalDetails:z.object({experienceMonths:z.number().int().min(0).max(11).optional(),firstName:z.string().trim().min(1).max(60),middleName:z.string().trim().max(60).optional(),lastName:z.string().trim().max(60),address:z.string().trim().max(300).optional(),dateOfBirth:z.union([z.literal(""),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&v<=new Date().toISOString().slice(0,10),"Enter a valid past date")]).optional(),gender:z.enum(["","Male","Female","Other","Prefer not to say"]).optional(),employmentStatus:z.enum(["","Fresher","Previously worked","Currently working"]).optional(),teachingMedium:z.string().trim().max(100).optional(),otherTeachingMedium:z.string().trim().max(100).optional(),                aadhaar:z.union([z.literal(""),z.string().regex(/^[0-9]{12}$/, "Enter a 12-digit Aadhaar number")]).optional()}).optional(),
        pharmacyDetails:z.preprocess(v=>v&&typeof v==="object"&&!Object.keys(v as object).length?undefined:v,z.object({registered:z.enum(["Yes","No","Pending"]),council:z.string().trim().max(150),registrationNumber:z.string().trim().max(100),workType:z.enum(["Full-time","Part-time","Both"]),expectedPay:z.number().int().min(0).max(10000000).nullable().optional()}).optional()),
        currentPlaceId:z.string().nullable().optional(),
        preferredPlaceIds:z.array(z.string()).max(20).optional(),
        jobSeeking: z.boolean().optional(),
        directoryVisible: z.boolean(),
        directoryConsent: z.boolean(),
        active: z.boolean(),
        education: z
          .array(
            z.object({
              degree: publicText,
              highest:z.boolean().optional(),
              institution: publicText,
              stream: z.string().trim().max(100).optional(),
              year: z.number().int().min(1950).max(2100),
              resultType:z.enum(["Percentage","Grade","CGPA"]).optional(),
              result:z.string().trim().max(20).optional(),
            }),
          )
          .optional(),
        experienceEntries: z
          .array(
            z.object({
              role: publicText,
              years: z.number().int().min(0).max(60),
              subject:publicText.optional(),
            }),
          )
          .optional(),
        skills: z.array(publicText).max(30).optional(),
        subjects: z.array(publicText).max(30).optional(),
        preferredLocations: z.array(publicText).max(20).optional(),
        availability: publicText.optional(),
        noticeDays: z.number().int().min(0).max(365).optional(),
      })
      .parse(body);
    return tx(async (t) => {
      const c = await t.candidate.findUniqueOrThrow({
        where: { userId: s.user.id },
      });
      await lock(t, "candidate:" + c.id);
      if(c.profession==="PHARMACIST"){
        if(!b.pharmacyDetails)throw new BadRequestException("Pharmacy work and registration details required");
        if(b.pharmacyDetails.registered==="Yes"&&(!b.pharmacyDetails.council||!b.pharmacyDetails.registrationNumber))throw new BadRequestException("Pharmacy council and registration number required when registered");
        if(!b.education?.length)throw new BadRequestException("Add at least one pharmacy qualification");
        for(const e of b.education)if(e.resultType==="Percentage"&&e.result&&(Number.isNaN(Number(e.result))||Number(e.result)<0||Number(e.result)>100))throw new BadRequestException("Education percentage must be between 0 and 100");
      }else if(b.pharmacyDetails)throw new BadRequestException("Pharmacy details do not belong to a teacher profile");
      if(b.currentPlaceId){const place=await t.geoPlace.findUnique({where:{id:b.currentPlaceId}});if(!place)throw new BadRequestException("Choose a valid current place");b.location=place.name+", "+place.district;}
      if(b.preferredPlaceIds?.length)b.preferredLocations=(await t.geoPlace.findMany({where:{id:{in:b.preferredPlaceIds}}})).map(p=>p.name);
      if(b.preferredPlaceIds?.length&&(await t.geoPlace.count({where:{id:{in:[...new Set(b.preferredPlaceIds)]}}}))!==new Set(b.preferredPlaceIds).size)throw new BadRequestException("Choose valid preferred locations");
      await requireFee(t, s.user, "PROFILE");
      await t.setting.upsert({
        where: { key: "profile-activation:" + s.user.id },
        update: {},
        create: { key: "profile-activation:" + s.user.id, value: true },
      });
      const updated = await t.candidate.update({
        where: { id: c.id },
        data: { ...b, profileReviewed: c.profileReviewed||(await t.setting.findUnique({where:{key:"teacher_auto_approve_enabled"}}))?.value===true, revision: { increment: 1 } },
      });
      if (b.mobile !== c.mobile)
        await t.user.update({
          where: { id: s.user.id },
          data: { mobileVerified: false },
        });
      if(b.jobSeeking!==undefined && b.jobSeeking!==c.jobSeeking) await audit(t,s.user,"CANDIDATE_AVAILABILITY_CHANGED",c.id,{jobSeeking:b.jobSeeking});
      await audit(t, s.user, "PROFILE_PRIVACY_UPDATED", c.id, {
        active: b.active,
        directoryVisible: b.directoryVisible,
        directoryConsent: b.directoryConsent,
      });
      if (!b.active || (!b.directoryConsent && c.directoryConsent)) {
        await t.$queryRawUnsafe("SELECT set_config('app.role','SYSTEM',true)");
        const unlocks = await t.unlock.findMany({
          where: { candidateId: c.id },
        });
        for (const u of unlocks)
          await notifyTenant(
            t,
            u.tenantId,
            "Candidate privacy updated",
            c.displayId +
              " changed contact permissions. Contact access is reevaluated.",
          );
        await setScope(t);
      }
      return updated;
    });
  }
  @Get("jobs") async jobs(@Req() req: any, @Query("q") q = "") {
    const viewer=(await actor(req)).user;const profile=viewer.role==="CANDIDATE"?await db.candidate.findUnique({where:{userId:viewer.id}}):null;
    await flag("candidate_job_search_enabled");
    const eligible = await db.tenant.findMany({
      where: { blocked: false },
      select: { id: true, name: true },
    });
    const policy = await db.setting.findUnique({
      where: { key: "expired_subscription_job_policy" },
    });
    if (policy?.value === "HIDE_AFTER_EXPIRY") {
      const allowed = await Promise.all(
        eligible.map(async (tenant) =>
          base.$transaction(async (t) => {
            await setScope(t);
            return { tenant, active: await hasActivePlan(tenant.id, t) };
          }),
        ),
      );
      eligible.splice(
        0,
        eligible.length,
        ...allowed.filter((row) => row.active).map((row) => row.tenant),
      );
    }
    const jobs = await db.job.findMany({
      where: {
        ...(profile?{profession:profile.profession}:{}),
        status: "PUBLISHED",
        closesAt: { gt: new Date() },
        tenantId: { in: eligible.map((t) => t.id) },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jobs.map((j) => ({
      ...j,
      institution: eligible.find((t) => t.id === j.tenantId)?.name,
    }));
  }
  @Get("institution/jobs") async ownJobs(@Req() req: any) {
    const u = await tenantActor(req);
    return db.job.findMany({
      where: { tenantId: u.tenantId },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("institution/jobs") async postJob(@Req() req: any, @Body() body: any) {
    const u = await tenantActor(req);
    const b = z
      .object({
        profession:z.enum(["TEACHER","PHARMACIST"]).default("TEACHER"),
        title: publicText,
        subject: publicText,
        location: publicText,
        salary: z.number().int().min(0),
        description: z.string().min(20).max(5000),
        closesAt: z.string().datetime(),
      })
      .parse(body);
    if (new Date(b.closesAt) <= new Date())
      throw new BadRequestException("Closing date must be in the future");
    return tx(async (t) => {
      await lock(t, "tenant:" + u.tenantId);
      const employer=await t.tenant.findUniqueOrThrow({where:{id:u.tenantId}});if(!employer.recruitingProfessions.includes(b.profession))throw new ForbiddenException("Enable this profession in your institution profile first");
      await flag("institution_job_posting_enabled", t);
      await requireFee(t, u, "JOB");
      if (!(await pricing(t))?.enabled) {
        const s = await currentSub(u.tenantId, t);
        if (!s) throw new ForbiddenException("Active subscription required");
        const p = s.snapshot as any;
        const count = await t.job.count({
          where: { tenantId: u.tenantId, createdAt: { gte: s.startsAt } },
        });
        const activeCount = await t.job.count({
          where: {
            tenantId: u.tenantId,
            status: "PUBLISHED",
            closesAt: { gt: new Date() },
          },
        });
        if (
          p.jobLimit !== -1 &&
          (count >= p.jobLimit || activeCount >= p.jobLimit)
        )
          throw new ForbiddenException("JOB_QUOTA_EXHAUSTED");
      }
      const j = await t.job.create({
        data: { ...b, closesAt: new Date(b.closesAt), tenantId: u.tenantId },
      });
      await audit(t, u, "JOB_POSTED", j.id);
      return j;
    });
  }
  @Patch("institution/jobs/:id/close") async closeJob(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const u = await tenantActor(req);
    const result = await db.job.updateMany({
      where: { id, tenantId: u.tenantId },
      data: { status: "CLOSED" },
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }
  @Post("jobs/:id/apply") async apply(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["CANDIDATE"]);
    const b = z.object({ contactConsent: z.boolean() }).parse(body);
    return tx(async (t) => {
      await flag("candidate_job_applications_enabled", t);
      const c = await t.candidate.findUniqueOrThrow({
        where: { userId: s.user.id },
      });
      await lock(t, "application:" + id + ":" + c.id);
      const job = await t.job.findUnique({ where: { id } });
      if (!job || job.status !== "PUBLISHED" || job.closesAt <= new Date())
        throw new BadRequestException("Job is closed");
      if(job.profession!==c.profession)throw new ForbiddenException("This vacancy is for a different profession");
      const tenant = await t.tenant.findUniqueOrThrow({
        where: { id: job.tenantId },
      });
      if (tenant.blocked || !c.active)
        throw new ForbiddenException("Application not permitted");
      const expiryPolicy = await t.setting.findUnique({
        where: { key: "expired_subscription_job_policy" },
      });
      if (
        expiryPolicy?.value &&
        expiryPolicy.value !== "KEEP_UNTIL_CLOSE" &&
        !(await hasActivePlan(job.tenantId, t))
      )
        throw new ForbiddenException(
          "This job is not accepting applications under the institution expiry policy",
        );
      const waitingSetting = await t.setting.findUnique({
        where: { key: "reapply_waiting_days" },
      });
      const waitingDays =
        typeof waitingSetting?.value === "number" ? waitingSetting.value : 30;
      const previous = await t.application.findFirst({
        where: { jobId: id, candidateId: c.id },
        orderBy: { attempt: "desc" },
      });
      if (
        previous &&
        !canReapply(previous.status, previous.closedAt, new Date(), waitingDays)
      ) {
        if (previous.status === "APPLIED") return previous;
        throw new BadRequestException(
          "An active attempt exists or the 30-day waiting period has not elapsed",
        );
      }
      await requireFee(
        t,
        s.user,
        "APPLICATION",
        id + ":" + ((previous?.attempt || 0) + 1),
      );
      const a = await t.application.create({
        data: {
          tenantId: job.tenantId,
          jobId: id,
          candidateId: c.id,
          attempt: (previous?.attempt || 0) + 1,
          contactConsent: b.contactConsent,
        },
      });
      await audit(t,s.user,"APPLICATION_SUBMITTED",a.id,{jobId:id});
      await t.pipeline.create({
        data: {
          tenantId: job.tenantId,
          candidateId: c.id,
          jobId: id,
          applicationId: a.id,
          source: "JOB_APPLICATION",
          stage: "APPLIED",
        },
      });
      await t.statusHistory.create({
        data: { applicationId: a.id, status: "APPLIED", actorId: s.user.id },
      });
      await notifyTenant(
        t,
        job.tenantId,
        "New application",
        "A candidate applied for " + job.title,
      );
      return a;
    });
  }
  @Get("applications") async applications(@Req() req: any) {
    const s = await actor(req, ["CANDIDATE"]);
    const c = await db.candidate.findUniqueOrThrow({
      where: { userId: s.user.id },
    });
    const apps = await db.application.findMany({
      where: { candidateId: c.id },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      apps.map(async (a) => ({
        ...a,
        job: await db.job.findUnique({
          where: { id: a.jobId },
          select: { title: true, location: true },
        }),
        history: await db.statusHistory.findMany({
          where: { applicationId: a.id },
          orderBy: { createdAt: "asc" },
        }),
      })),
    );
  }
  @Patch("applications/:id") async candidateApplication(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["CANDIDATE"]);
    const b = z
      .object({
        contactConsent: z.boolean().optional(),
        withdraw: z.boolean().optional(),
      })
      .parse(body);
    return tx(async (t) => {
      const c = await t.candidate.findUniqueOrThrow({
        where: { userId: s.user.id },
      });
      await lock(t, "candidate:" + c.id);
      const a = await t.application.findFirst({
        where: { id, candidateId: c.id },
      });
      if (!a) throw new NotFoundException();
      const withdrawing = !!b.withdraw && a.status !== "WITHDRAWN";
      await t.application.update({
        where: { id },
        data: {
          contactConsent: b.withdraw ? false : b.contactConsent,
          ...(withdrawing ? { status: "WITHDRAWN", closedAt: new Date() } : {}),
        },
      });
      if (withdrawing) {
        await t.pipeline.updateMany({
          where: { applicationId: id },
          data: { stage: "WITHDRAWN" },
        });
        await t.statusHistory.create({
          data: { applicationId: id, status: "WITHDRAWN", actorId: s.user.id },
        });
      }
      await audit(t, s.user, "APPLICATION_PRIVACY_UPDATED", id, {
        contactConsent: b.contactConsent ?? a.contactConsent,
        withdraw: !!b.withdraw,
      });
      await notifyTenant(
        t,
        a.tenantId,
        "Application updated",
        "A candidate updated application consent or withdrew.",
      );
      return { ok: true };
    });
  }
  @Get("institution/candidates") async search(
    @Req() req: any,
    @Query("q") q = "",
    @Query("degree") degree = "",
    @Query("place") place = "",
    @Query("session") session = "",
    @Query("page") page = "1",
    @Query("profession") profession="",
    @Query("near") near="",
    @Query("radius") radius="50",
    @Query("locationMode") locationMode="current",
  ) {
    const u = await tenantActor(req);
    const index = z.coerce.number().int().min(1).max(100).parse(page);
    const normalized = q.trim().toLowerCase().slice(0, 100);
    return tx(async (t) => {
      await lock(t, "tenant:" + u.tenantId);
      await flag("institution_candidate_search_enabled", t);
      const employer=await t.tenant.findUniqueOrThrow({where:{id:u.tenantId}});
      if(profession&&!employer.recruitingProfessions.includes(profession))throw new ForbiddenException("Profession not selected by your institution");
      const professions=profession?[profession]:employer.recruitingProfessions;
      const origin=near?await t.geoPlace.findUnique({where:{id:near}}):null;if(near&&!origin)throw new BadRequestException("Choose a valid nearby place");
      const km=z.coerce.number().min(1).max(500).parse(radius);
      if(!["current","preferred"].includes(locationMode))throw new BadRequestException("Invalid location mode");
      let distances=new Map<string,number>();let nearbyIds:string[]=[];
      if(origin){const places=await t.geoPlace.findMany({where:{latitude:{gte:origin.latitude-km/111.0,lte:origin.latitude+km/111.0},longitude:{gte:origin.longitude-km/(111*Math.cos(origin.latitude*Math.PI/180)),lte:origin.longitude+km/(111*Math.cos(origin.latitude*Math.PI/180))}}});for(const p of places){const d=distanceKm(origin.latitude,origin.longitude,p.latitude,p.longitude);if(d<=km){nearbyIds.push(p.id);distances.set(p.id,d);}}}

      let search: any = { id: "simple" };
      if (!(await pricing(t))?.enabled) {
        const s = await currentSub(u.tenantId, t);
        if (!s) throw new ForbiddenException("Active subscription required");
        search = session
          ? await t.searchSession.findFirst({
              where: {
                id: session,
                tenantId: u.tenantId,
                subscriptionId: s.id,
                expiresAt: { gt: new Date() },
              },
            })
          : null;
        const fingerprint = createHash("sha256")
          .update(JSON.stringify([normalized,degree.trim().toLowerCase(),place.trim().toLowerCase(),professions,near,km,locationMode]))
          .digest("hex");
        if (search && search.fingerprint !== fingerprint)
          throw new BadRequestException("Search session does not match query");
        if (!search) {
          search = await t.searchSession.findUnique({
            where: {
              tenantId_subscriptionId_fingerprint: {
                tenantId: u.tenantId,
                subscriptionId: s.id,
                fingerprint,
              },
            },
          });
          if (!search || search.expiresAt <= new Date()) {
            const p = s.snapshot as any;
            if (p.searchLimit !== -1 && s.searchesUsed >= p.searchLimit)
              throw new ForbiddenException("SEARCH_QUOTA_EXHAUSTED");
            await t.subscription.update({
              where: { id: s.id },
              data: { searchesUsed: { increment: 1 } },
            });
            search = await t.searchSession.upsert({
              where: {
                tenantId_subscriptionId_fingerprint: {
                  tenantId: u.tenantId,
                  subscriptionId: s.id,
                  fingerprint,
                },
              },
              create: {
                tenantId: u.tenantId,
                subscriptionId: s.id,
                fingerprint,
                expiresAt: new Date(Date.now() + 900000),
              },
              update: { expiresAt: new Date(Date.now() + 900000) },
            });
          }
        }
      }
      let rows = await t.candidate.findMany({
        where: {
          profession:{in:professions},
          ...(origin?(locationMode==="preferred"?{preferredPlaceIds:{hasSome:nearbyIds}}:{currentPlaceId:{in:nearbyIds}}):{}),
          active: true,
          directoryVisible: true,
          jobSeeking: true,
          profileReviewed: true,
          ...(degree.trim()?{qualification:{in:[degree.trim().slice(0,100),degree.trim().replaceAll(".","").slice(0,100)],mode:"insensitive" as const}}:{}),
          ...(place.trim()?{location:{contains:place.trim().slice(0,100),mode:"insensitive" as const}}:{}),
          OR: [
            { subject: { contains: normalized, mode: "insensitive" } },
            { location: { contains: normalized, mode: "insensitive" } },
          ],
        },
        ...(origin?{}:{skip:(index-1)*12,take:12}),
      });
      if(origin){const candidateDistance=(c:any)=>locationMode==="preferred"?Math.min(...c.preferredPlaceIds.map((id:string)=>distances.get(id)??Infinity)):distances.get(c.currentPlaceId)||0;rows.sort((a,b)=>candidateDistance(a)-candidateDistance(b)||a.id.localeCompare(b.id));rows=rows.slice((index-1)*12,index*12);}
      const tenant = await t.tenant.findUnique({where:{id:u.tenantId}});
      const ids = rows.map(c=>c.id);
      const unlocks = tenant?.verified && !tenant.blocked ? await t.unlock.findMany({where:{tenantId:u.tenantId,candidateId:{in:ids}}}) : [];
      const applications = unlocks.length ? await t.application.findMany({where:{tenantId:u.tenantId,candidateId:{in:ids},contactConsent:true}}) : [];
      const unlockedIds = new Set(unlocks.map(v=>v.candidateId));
      const consentIds = new Set(applications.map(v=>v.candidateId));
      return { session: search.id, items: rows.map(c=>{const allowed=unlockedIds.has(c.id)&&contactAllowed(c.active,c.directoryConsent,consentIds.has(c.id));return {...anonymous(c),...(origin?{distanceKm:Math.round((locationMode==="preferred"?Math.min(...c.preferredPlaceIds.map(id=>distances.get(id)??Infinity)):distances.get(c.currentPlaceId!)!)*10)/10}:{}),contactUnlocked:allowed,...(allowed?{mobile:c.mobile}: {})};}), page: index };
    });
  }
  @Get("institution/candidates/:id/details") async candidateDetails(@Req() req:any,@Param("id") id:string) {
    const u=await tenantActor(req);return tx(async t=>{const applicant=await t.application.findFirst({where:{tenantId:u.tenantId,candidateId:id}});if(!applicant)await flag("institution_candidate_search_enabled",t);const c=await t.candidate.findFirst({where:{id,active:true,profileReviewed:true,...(!applicant?{directoryVisible:true}:{})},include:{user:true}});if(!c)throw new NotFoundException();const tenant=await t.tenant.findUnique({where:{id:u.tenantId}});const unlock=await t.unlock.findUnique({where:{tenantId_candidateId:{tenantId:u.tenantId,candidateId:id}}});const application=await t.application.findFirst({where:{tenantId:u.tenantId,candidateId:id,contactConsent:true}});if(!tenant?.recruitingProfessions.includes(c.profession)&&!unlock&&!applicant)throw new ForbiddenException("Profession not selected by your institution");const allowed=!!tenant?.verified&&!tenant.blocked&&!!unlock&&contactAllowed(c.active,c.directoryConsent,!!application);return {...anonymous(c),currentPlace:c.currentPlaceId?await t.geoPlace.findUnique({where:{id:c.currentPlaceId}}):null,preferredPlaces:await t.geoPlace.findMany({where:{id:{in:c.preferredPlaceIds}}}),unavailableReport:await t.unavailableReport.findFirst({where:{tenantId:u.tenantId,candidateId:id},select:{status:true,restoreCredit:true,markUnavailable:true,decisionReason:true}}),jobSeeking:c.jobSeeking,availability:c.availability,noticeDays:c.noticeDays,employmentStatus:(c.personalDetails as any)?.employmentStatus||"",teachingMedium:(c.personalDetails as any)?.teachingMedium==="Other"?(c.personalDetails as any)?.otherTeachingMedium:(c.personalDetails as any)?.teachingMedium,contactUnlocked:allowed,...(allowed?{pharmacyDetails:c.pharmacyDetails,contact:{name:c.user.name,email:c.user.email,mobile:c.mobile,address:(c.personalDetails as any)?.address||""},education:c.education,experienceEntries:c.experienceEntries,skills:c.skills,subjects:c.subjects,preferredLocations:c.preferredLocations}:{})};});
  }
  @Post("institution/applications/:id/viewed") async markApplicationViewed(@Req() req:any,@Param("id") id:string){
    const u=await tenantActor(req);
    return tx(async t=>{
      const a=await t.application.findFirst({where:{id,tenantId:u.tenantId}});
      if(!a)throw new NotFoundException("Application not found");
      const c=await t.candidate.findUniqueOrThrow({where:{id:a.candidateId}});
      const tenant=await t.tenant.findUniqueOrThrow({where:{id:u.tenantId}});
      const unlock=await t.unlock.findUnique({where:{tenantId_candidateId:{tenantId:u.tenantId,candidateId:c.id}}});
      if(!tenant.verified||tenant.blocked||!unlock||!c.profileReviewed||!contactAllowed(c.active,c.directoryConsent,a.contactConsent))throw new ForbiddenException("Unlock and open the full profile before marking this application viewed");
      const viewed=await t.application.updateMany({where:{id:a.id,tenantId:u.tenantId,firstViewedAt:null},data:{firstViewedAt:new Date()}});if(viewed.count)await audit(t,u,"APPLICATION_VIEWED",a.id);
      return {ok:true};
    });
  }
  @Get("institution/candidates/:id/contact") async contact(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const u = await tenantActor(req);
    return tx(async (t) => {
      await lock(t, "candidate:" + id);
      const c = await t.candidate.findUnique({
        where: { id },
        include: { user: true },
      });
      const unlock = await t.unlock.findUnique({
        where: {
          tenantId_candidateId: { tenantId: u.tenantId, candidateId: id },
        },
      });
      const application = await t.application.findFirst({
        where: { tenantId: u.tenantId, candidateId: id, contactConsent: true },
      });
      if (
        !c ||
        !unlock ||
        !contactAllowed(c.active, c.directoryConsent, !!application)
      )
        throw new ForbiddenException(
          "Contact unavailable under current consent",
        );
      return { name: c.user.name, email: c.user.email, mobile: c.mobile };
    });
  }
  @Post("institution/candidates/:id/unlock") async unlock(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const u = await tenantActor(req);
    return tx(async (t) => {
      await lock(t, "candidate:" + id);
      await lock(t, "tenant:" + u.tenantId);
      const c = await t.candidate.findUnique({
        where: { id },
        include: { user: true },
      });
      const application = await t.application.findFirst({
        where: { tenantId: u.tenantId, candidateId: id, contactConsent: true },
      });
      if (!c || !contactAllowed(c.active, c.directoryConsent, !!application))
        throw new ForbiddenException("Valid candidate consent required");
      const existing = await t.unlock.findUnique({
        where: {
          tenantId_candidateId: { tenantId: u.tenantId, candidateId: id },
        },
      });
      const employer=await t.tenant.findUniqueOrThrow({where:{id:u.tenantId}});if(!existing&&!employer.recruitingProfessions.includes(c.profession))throw new ForbiddenException("Profession not selected by your institution");
      if (!existing && !c.jobSeeking) throw new ForbiddenException("Candidate is not currently seeking a job");
      if (existing)
        return {
          charged: 0,
          name: c.user.name,
          email: c.user.email,
          mobile: c.mobile,
        };
      await flag("institution_candidate_unlock_enabled", t);
      const tenant = await t.tenant.findUniqueOrThrow({
        where: { id: u.tenantId },
      });
      if (!tenant.verified)
        throw new ForbiddenException("Institution verification required");
      if (!application && !c.directoryVisible)
        throw new ForbiddenException("Candidate not discoverable");
      const cfg = await pricing(t);
      if (cfg?.enabled && !cfg.unlockPaid) {
        await t.unlock.create({
          data: { tenantId: u.tenantId, candidateId: id, actorId: u.id },
        });
        await audit(t, u, "FREE_CANDIDATE_UNLOCK", id,{candidateReference:c.displayId,creditsUsed:0,access:"Contact access granted"});
        return {
          charged: 0,
          name: c.user.name,
          email: c.user.email,
          mobile: c.mobile,
        };
      }
      const s = await currentSub(u.tenantId, t);
      if (!s && !cfg?.enabled)
        throw new ForbiddenException("Active subscription required");
      const grant = await t.creditGrant.findFirst({
        where: {
          tenantId: u.tenantId,
          ...(cfg?.enabled
            ? {
                OR: [
                  { subscriptionId: { startsWith: "pack:" } },
                  { subscriptionId: s?.id || "__none" },
                ],
              }
            : { subscriptionId: s!.id }),
          remaining: { gt: 0 },
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      });
      if (!grant) throw new ForbiddenException("No unlock credits available");
      const unlocked = await t.unlock.create({
        data: { tenantId: u.tenantId, candidateId: id, actorId: u.id },
      });
      await t.creditGrant.update({
        where: { id: grant.id },
        data: { remaining: { decrement: 1 } },
      });
      await t.creditTransaction.create({
        data: {
          tenantId: u.tenantId,
          grantId: grant.id,
          delta: -1,
          type: "CANDIDATE_UNLOCK",
          reference: unlocked.id,
          actorId: u.id,
        },
      });
      await audit(t, u, "CANDIDATE_UNLOCKED", id,{candidateReference:c.displayId,creditsUsed:1,grantId:grant.id,creditsRemainingInGrant:grant.remaining-1,access:"Contact access granted"});
      return {
        charged: 1,
        name: c.user.name,
        email: c.user.email,
        mobile: c.mobile,
      };
    });
  }
  @Get("institution/hiring") async hiring(@Req() req: any) {
    const u = await tenantActor(req);
    const entries = await db.pipeline.findMany({
      where: { tenantId: u.tenantId },
    });
    return Promise.all(
      entries.map(async (p) => ({
        ...p,
        candidate: anonymous(
          await db.candidate.findUniqueOrThrow({
            where: { id: p.candidateId },
          }),
        ),
        notes: await db.note.findMany({
          where: { pipelineId: p.id, tenantId: u.tenantId },
        }),
        interviews: await db.interview.findMany({
          where: { pipelineId: p.id, tenantId: u.tenantId },
        }),
      })),
    );
  }
  @Post("institution/hiring") async source(@Req() req: any, @Body() body: any) {
    const u = await tenantActor(req);
    const b = z.object({ candidateId: z.string() }).parse(body);
    await flag("institution_candidate_search_enabled");
    if (!(await pricing(db))?.enabled && !(await currentSub(u.tenantId)))
      throw new ForbiddenException("Active subscription required");
    const c = await db.candidate.findFirst({
      where: {
        id: b.candidateId,
        active: true,
        directoryVisible: true,
        profileReviewed: true,
      },
    });
    if (!c) throw new NotFoundException();
    return tx(async (t) => {
      await lock(t, "source:" + u.tenantId + ":" + c.id);
      const employer=await t.tenant.findUniqueOrThrow({where:{id:u.tenantId}});if(!employer.recruitingProfessions.includes(c.profession))throw new ForbiddenException("Profession not selected by your institution");
      const existing = await t.pipeline.findFirst({
        where: {
          tenantId: u.tenantId,
          candidateId: c.id,
          source: "DIRECT_SEARCH",
        },
      });
      return (
        existing ||
        t.pipeline.create({
          data: {
            tenantId: u.tenantId,
            candidateId: c.id,
            source: "DIRECT_SEARCH",
            stage: "SOURCED",
          },
        })
      );
    });
  }
  @Patch("institution/hiring/:id") async stage(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await tenantActor(req);
    const b = z
      .object({
        stage: z.enum([
          "SOURCED",
          "APPLIED",
          "WITHDRAWN",
          "SHORTLISTED",
          "INTERVIEW",
          "SELECTED",
          "JOINED",
          "REJECTED",
          "NOT_SELECTED",
        ]),
        note: z.string().max(2000).optional(),
      })
      .parse(body);
    return tx(async (t) => {
      const p = await t.pipeline.findFirst({
        where: { id, tenantId: u.tenantId },
      });
      if (!p) throw new NotFoundException();
      await lock(t, "candidate:" + p.candidateId);
      if (
        ["SOURCED", "APPLIED", "WITHDRAWN"].includes(b.stage) &&
        b.stage !== p.stage
      )
        throw new BadRequestException(
          "This stage is controlled by its originating workflow",
        );
      if (p.applicationId) {
        const a = await t.application.findUniqueOrThrow({
          where: { id: p.applicationId },
        });
        if (a.status === "WITHDRAWN" && b.stage !== "WITHDRAWN")
          throw new BadRequestException(
            "A withdrawn application cannot be reopened by the institution",
          );
      }
      await t.pipeline.update({ where: { id }, data: { stage: b.stage } });
      if (b.note)
        await t.note.create({
          data: {
            tenantId: u.tenantId,
            pipelineId: id,
            text: b.note,
            actorId: u.id,
          },
        });
      if(b.note)await audit(t,u,"NOTE_ADDED",id);
      if (p.applicationId && b.stage !== p.stage) {
        await t.application.update({
          where: { id: p.applicationId },
          data: {
            status: b.stage,
            closedAt: terminalStatuses.includes(b.stage) ? new Date() : null,
          },
        });
        await t.statusHistory.create({
          data: {
            applicationId: p.applicationId,
            status: b.stage,
            actorId: u.id,
          },
        });
        const c = await t.candidate.findUniqueOrThrow({
          where: { id: p.candidateId },
        });
        await t.notification.create({
          data: {
            userId: c.userId,
            title: "Application status updated",
            body: "Your application is now " + b.stage,
          },
        });
      }
      await audit(t, u, "HIRING_STAGE_CHANGED", id, { stage: b.stage });
      return { ok: true };
    });
  }
  @Post("institution/hiring/:id/interviews") async interview(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await tenantActor(req);
    const b = z
      .object({
        scheduledAt: z.string().datetime(),
        mode: z.enum(["ONLINE", "IN_PERSON", "PHONE"]),
        details: z.string().max(2000),
      })
      .parse(body);
    if (new Date(b.scheduledAt) <= new Date())
      throw new BadRequestException("Choose a future date");
    return tx(async (t) => {
      const p = await t.pipeline.findFirst({
        where: { id, tenantId: u.tenantId },
      });
      if (!p) throw new NotFoundException();
      await lock(t, "candidate:" + p.candidateId);
      if (p.applicationId) {
        const application = await t.application.findUniqueOrThrow({
          where: { id: p.applicationId },
        });
        if (application.status === "WITHDRAWN")
          throw new ForbiddenException("Application withdrawn");
      }
      const candidate = await t.candidate.findUniqueOrThrow({
        where: { id: p.candidateId },
      });
      if (p.source === "DIRECT_SEARCH" && !candidate.directoryConsent)
        throw new ForbiddenException("Candidate contact consent required");
      if (!candidate.active)
        throw new ForbiddenException("Candidate is inactive");
      const i = await t.interview.create({
        data: {
          ...b,
          scheduledAt: new Date(b.scheduledAt),
          tenantId: u.tenantId,
          pipelineId: id,
        },
      });
      const c = await t.candidate.findUniqueOrThrow({
        where: { id: p.candidateId },
      });
      await t.notification.create({
        data: {
          userId: c.userId,
          title: "Interview scheduled",
          body: b.mode + " interview at " + b.scheduledAt + ". " + b.details,
        },
      });
      await audit(t,u,"INTERVIEW_SCHEDULED",id,{scheduledAt:b.scheduledAt,mode:b.mode});
      return i;
    });
  }
  @Get("plans") async plans(@Req() req: any) {
    await actor(req);
    return db.plan.findMany({
      where: { active: true },
      orderBy: { amount: "asc" },
    });
  }
  @Get("institution/account") async account(@Req() req: any) {
    const u = await tenantActor(req);
    const sub = await currentSub(u.tenantId);
    const cfg = await pricing(db);
    return {
      tenant: await db.tenant.findUnique({ where: { id: u.tenantId } }),
      subscription: sub,
      pricing: cfg,
      credits:
        sub || cfg?.enabled
          ? (
              await db.creditGrant.aggregate({
                where: {
                  tenantId: u.tenantId,
                  ...(cfg?.enabled
                    ? {
                        OR: [
                          { subscriptionId: { startsWith: "pack:" } },
                          { subscriptionId: sub?.id || "__none" },
                        ],
                      }
                    : { subscriptionId: sub!.id }),
                  expiresAt: { gt: new Date() },
                },
                _sum: { remaining: true },
              })
            )._sum.remaining || 0
          : 0,
      payments: await db.paymentRequest.findMany({
        where: { tenantId: u.tenantId },
        orderBy: { createdAt: "desc" },
      }),
      ledger: await db.creditTransaction.findMany({
        where: { tenantId: u.tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      invoices: await db.invoice.findMany({ where: { tenantId: u.tenantId } }),
    };
  }
  @Post("institution/payments") async payment(
    @Req() req: any,
    @Body() body: any,
  ) {
    const u = await tenantActor(req);
    const b = z.object({ planId: z.string() }).parse(body);
    const p = await db.plan.findFirst({
      where: { id: b.planId, active: true, amount: { gt: 0 } },
    });
    const config = await db.setting.findUnique({ where: { key: "payment" } });
    const payee = config?.value as any;
    if (!p || !payee?.enabled || !payee.upiId)
      throw new BadRequestException(
        "Manual UPI is not configured or plan unavailable",
      );
    return db.paymentRequest.create({
      data: {
        tenantId: u.tenantId,
        planId: p.id,
        amount: p.amount,
        snapshot: moneyPlan(p),
        payeeSnapshot: payee,
      },
    });
  }
  @Post("institution/payments/:id/submit") async submit(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const u = await tenantActor(req);
    const b = z.object({ utr: z.string().trim().min(6).max(100) }).parse(body);
    const p = await db.paymentRequest.updateMany({
      where: {
        id,
        tenantId: u.tenantId,
        status: { in: ["AWAITING_PAYMENT", "REJECTED"] },
      },
      data: {
        utr: b.utr.toUpperCase(),
        status: "UNDER_REVIEW",
        decisionReason: null,
      },
    });
    if (!p.count) throw new BadRequestException("Payment cannot be submitted");
    return { ok: true };
  }
  @Post("institution/candidates/:id/unavailable-report") async reportUnavailable(@Req() req:any,@Param("id") id:string,@Body() body:any){
    const u=await tenantActor(req);const b=z.object({reason:z.string().trim().min(10).max(500)}).parse(body);
    return tx(async t=>{await lock(t,"candidate:"+id);await lock(t,"tenant:"+u.tenantId);
      const unlock=await t.unlock.findUnique({where:{tenantId_candidateId:{tenantId:u.tenantId,candidateId:id}}});
      if(!unlock)throw new ForbiddenException("Unlock this candidate before reporting");
      if(await t.unavailableReport.findUnique({where:{unlockId:unlock.id}}))throw new BadRequestException("This unlock has already been reported");
      const report=await t.unavailableReport.create({data:{tenantId:u.tenantId,candidateId:id,unlockId:unlock.id,reportedBy:u.id,reason:b.reason}});
      await audit(t,u,"CANDIDATE_UNAVAILABLE_REPORTED",report.id,{candidateId:id,unlockId:unlock.id});return report;});
  }
  @Get("admin/unavailable-reports") async unavailableReports(@Req() req:any){
    await actor(req,["SUPER_ADMIN","PLATFORM_ADMIN"]);
    const rows=await db.unavailableReport.findMany({orderBy:{createdAt:"desc"}});
    return Promise.all(rows.map(async r=>({...r,institution:(await db.tenant.findUnique({where:{id:r.tenantId}}))?.name,candidate:(await db.candidate.findUnique({where:{id:r.candidateId},select:{displayId:true,jobSeeking:true}})),paidUnlock:!!await db.creditTransaction.findUnique({where:{reference:r.unlockId}})})));
  }
  @Post("admin/unavailable-reports/:id/decision") async decideUnavailable(@Req() req:any,@Param("id") id:string,@Body() body:any){
    const u=(await actor(req,["SUPER_ADMIN","PLATFORM_ADMIN"])).user;
    const b=z.object({restoreCredit:z.boolean(),markUnavailable:z.boolean(),reason:z.string().trim().min(5).max(500),validityDays:z.number().int().min(1).max(365).default(30)}).parse(body);
    return tx(async t=>{const r=await t.unavailableReport.findUniqueOrThrow({where:{id}});await lock(t,"candidate:"+r.candidateId);await lock(t,"tenant:"+r.tenantId);await lock(t,"unavailable-report:"+id);
      const fresh=await t.unavailableReport.findUniqueOrThrow({where:{id}});if(fresh.status!=="PENDING")throw new BadRequestException("Report already reviewed");
      if(b.restoreCredit){const debit=await t.creditTransaction.findUnique({where:{reference:r.unlockId}});if(!debit||debit.tenantId!==r.tenantId||debit.delta!==-1||debit.type!=="CANDIDATE_UNLOCK")throw new BadRequestException("No paid credit was used for this unlock");
        const cfg=await pricing(t),sub=await currentSub(r.tenantId,t);if(!cfg?.enabled&&!sub)throw new BadRequestException("Institution needs an active subscription before a replacement credit can be issued");
        const expiresAt=new Date(Date.now()+b.validityDays*86400000);
        const grant=await t.creditGrant.create({data:{tenantId:r.tenantId,subscriptionId:cfg?.enabled?"pack:replacement:"+r.id:sub!.id,remaining:1,amount:1,expiresAt}});
        await t.creditTransaction.create({data:{tenantId:r.tenantId,grantId:grant.id,delta:1,type:"REPLACEMENT_CREDIT",reference:"replacement:"+r.unlockId,actorId:u.id}});
        await audit(t,{...u,tenantId:r.tenantId},"REPLACEMENT_CREDIT_GRANTED",r.id,{unlockId:r.unlockId,credits:1,expiresAt,reason:b.reason});
        await notifyTenant(t,r.tenantId,"Replacement credit approved","1 credit has been returned to your institution. Valid until "+expiresAt.toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})+".");
      }
      if(b.markUnavailable){const c=await t.candidate.update({where:{id:r.candidateId},data:{jobSeeking:false}});await audit(t,u,"CANDIDATE_AVAILABILITY_CHANGED",c.id,{jobSeeking:false,reportId:id});await t.notification.create({data:{userId:c.userId,title:"Job availability updated",body:"Your profile is marked not currently seeking after an admin review. You can update Job availability in Profile > Privacy when you are ready."}});}
      const result=await t.unavailableReport.update({where:{id},data:{status:b.restoreCredit||b.markUnavailable?"APPROVED":"REJECTED",restoreCredit:b.restoreCredit,markUnavailable:b.markUnavailable,decisionReason:b.reason,reviewedBy:u.id,reviewedAt:new Date()}});
      await audit(t,{...u,tenantId:r.tenantId},"UNAVAILABLE_REPORT_REVIEWED",id,{restoreCredit:b.restoreCredit,markUnavailable:b.markUnavailable,reason:b.reason});return result;});
  }
  @Get("admin/audit") async auditLog(@Req() req:any,@Query() q:any){
    await actor(req,["SUPER_ADMIN","PLATFORM_ADMIN"]);
    if((q.from&&!/^\d{4}-\d{2}-\d{2}$/.test(q.from))||(q.to&&!/^\d{4}-\d{2}-\d{2}$/.test(q.to)))throw new BadRequestException("Use valid dates");
    const page=Math.max(1,Math.floor(Number(q.page)||1)),size=[5,10,25,50].includes(Number(q.size))?Number(q.size):10;
    const where:any={...(q.action?{action:q.action}:{}),...(q.from||q.to?{createdAt:{...(q.from?{gte:new Date(q.from+"T00:00:00+05:30")}:{}),...(q.to?{lte:new Date(q.to+"T23:59:59.999+05:30")}: {})}}:{})};
    if(q.search){const users=await db.user.findMany({where:{OR:[{name:{contains:q.search,mode:"insensitive"}},{email:{contains:q.search,mode:"insensitive"}}]},select:{id:true}});where.OR=[{action:{contains:q.search,mode:"insensitive"}},{entityId:{contains:q.search,mode:"insensitive"}},{actorId:{in:users.map(u=>u.id)}}];}
    const [total,rows,actions]=await Promise.all([db.audit.count({where}),db.audit.findMany({where,orderBy:{createdAt:"desc"},skip:(page-1)*size,take:size}),db.audit.findMany({distinct:["action"],select:{action:true},orderBy:{action:"asc"}})]);
    const safe=(value:any):any=>Array.isArray(value)?value.map(safe):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).filter(([key])=>!/password|otp|aadhaar|token|secret|mobile|email|address/i.test(key)).map(([key,v])=>[key,safe(v)])):value;
    const items=await Promise.all(rows.map(async row=>{const candidate=/CANDIDATE_UNLOCK/.test(row.action)?await db.candidate.findUnique({where:{id:row.entityId},select:{displayId:true,qualification:true,location:true}}):null;return {...row,details:safe(row.details),candidate,user:await db.user.findUnique({where:{id:row.actorId},select:{name:true,email:true}}),institution:row.tenantId?(await db.tenant.findUnique({where:{id:row.tenantId},select:{name:true}}))?.name:null};}));
    return {items,total,actions:[...new Set(["AUTH_LOGIN","AUTH_LOGIN_FAILED","AUTH_LOGOUT","ACCOUNT_CREATED","APPLICATION_SUBMITTED","APPLICATION_VIEWED","CANDIDATE_UNLOCKED","FREE_CANDIDATE_UNLOCK","HIRING_STAGE_CHANGED","NOTE_ADDED","INTERVIEW_SCHEDULED","PAYMENT_APPROVED","PAYMENT_REJECTED",...actions.map(a=>a.action)])].sort()};
  }
  @Get("admin/overview") async adminOverview(@Req() req: any) {
    await actor(req, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    return {
      tenants: await Promise.all((await db.tenant.findMany()).map(async tenant => {
        const profile = (await db.setting.findUnique({where:{key:"institution-profile:"+tenant.id}}))?.value as any;
        const owner = await db.user.findFirst({where:{tenantId:tenant.id,role:"TENANT_ADMIN"},select:{name:true,email:true}});
        return {...tenant,contactPerson:profile?.contactPerson||owner?.name||"",mobile:profile?.mobile||"",officialEmail:profile?.officialEmail||owner?.email||"",address:profile?.address||"",type:profile?.type||""};
      })),
      payments: await db.paymentRequest.findMany({
        orderBy: { createdAt: "desc" },
      }),
      plans: await db.plan.findMany(),
      settings: await db.setting.findMany({
        where: { NOT: { key: { startsWith: "institution-profile:" } } },
      }),
      audit: await db.audit.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      candidateCount: await db.candidate.count(),
      commerceReviewCount: await db.commerceOrder.count({
        where: { status: "UNDER_REVIEW" },
      }),
    };
  }
  @Patch("admin/tenants/:id") async verify(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    const b = z
      .object({
        verified: z.boolean().optional(),
        blocked: z.boolean().optional(),
      })
      .parse(body);
    return tx(async (t) => {
      const tenant = await t.tenant.update({ where: { id }, data: b });
      await audit(t, s.user, "INSTITUTION_UPDATED", id, b);
      return tenant;
    });
  }
  @Patch("admin/settings/:key") async settings(
    @Req() req: any,
    @Param("key") key: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN"]);
    let value: any;
    if (key === "simple_pricing") {
      value = z
        .object({
          enabled: z.boolean(),
          profileFee: z.number().int().min(0).max(10000000),
          applicationFee: z.number().int().min(0).max(10000000),
          jobFee: z.number().int().min(0).max(10000000),
          unlockPaid: z.boolean(),
          packPrice: z.number().int().min(100).max(10000000),
          packCredits: z.number().int().min(1).max(10000),
          validityDays: z.number().int().min(1).max(3650),
        })
        .parse(body.value);
    } else if (key === "payment") {
      value = z
        .object({
          method: z.literal("MANUAL_UPI"),
          upiId: z.string().regex(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/),
          payeeName: z.string().min(2).max(100),
          qrAsset: z.string().regex(/^\/assets\/[a-zA-Z0-9_-]+\.(png|svg)$/),
          enabled: z.boolean(),
        })
        .parse(body.value);
    } else if (key === "expired_subscription_job_policy") {
      value = z
        .enum([
          "KEEP_UNTIL_CLOSE",
          "KEEP_VISIBLE_PAUSE_APPLICATIONS",
          "HIDE_AFTER_EXPIRY",
        ])
        .parse(body.value);
    } else if (key === "reapply_waiting_days") {
      value = z.number().int().min(0).max(365).parse(body.value);
    } else {
      if (
        ![
          "institution_job_posting_enabled",
          "candidate_job_search_enabled",
          "candidate_job_applications_enabled",
          "institution_candidate_search_enabled",
          "institution_candidate_unlock_enabled",
          "teacher_auto_approve_enabled",
        ].includes(key)
      )
        throw new BadRequestException("Unknown setting");
      value = z.boolean().parse(body.value);
    }
    return tx(async (t) => {
      const old = await t.setting.findUnique({ where: { key } });
      const updated = await t.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value, version: { increment: 1 } },
      });
      if(key==="teacher_auto_approve_enabled"&&value===true){const activated=await t.setting.findMany({where:{key:{startsWith:"profile-activation:"},value:{equals:true}}});const result=await t.candidate.updateMany({where:{userId:{in:activated.map((v:any)=>v.key.slice("profile-activation:".length))},profileReviewed:false,user:{active:true}},data:{profileReviewed:true}});await audit(t,s.user,"PENDING_PROFILES_AUTO_APPROVED",key,{count:result.count});}
      await audit(t, s.user, "SETTING_UPDATED", key, {
        before: old?.value ?? null,
        after: value,
      });
      return updated;
    });
  }
  @Patch("admin/plans/:id") async editPlan(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    const b = z
      .object({
        name: z.string().min(2),
        amount: z.number().int().min(0),
        days: z.number().int().min(1).max(366),
        credits: z.number().int().min(0),
        jobLimit: z.number().int().min(-1),
        searchLimit: z.number().int().min(-1),
        active: z.boolean(),
        creditExpiryPolicy: z.enum(["EXPIRE", "CARRY_FORWARD"]).optional(),
        carryForwardCap: z.number().int().min(0).nullable().optional(),
      })
      .parse(body);
    return tx(async (t) => {
      const p = await t.plan.update({ where: { id }, data: b });
      await audit(t, s.user, "PLAN_UPDATED", id, b);
      return p;
    });
  }
  @Post("admin/payments/:id/decision") async decide(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN"]);
    const b = z
      .object({
        approve: z.boolean(),
        receiptReference: z.string().min(6).max(120).optional(),
        receivedAmount: z.number().int().optional(),
        reason: z.string().min(5).max(500),
      })
      .parse(body);
    return tx(async (t) => {
      await lock(t, "payment:" + id);
      const p = await t.paymentRequest.findUnique({ where: { id } });
      if (!p) throw new NotFoundException();
      if (p.status === "APPROVED") return { ok: true, alreadyApproved: true };
      if (p.status !== "UNDER_REVIEW")
        throw new BadRequestException("Payment is not under review");
      if (!b.approve) {
        await t.paymentRequest.update({
          where: { id },
          data: {
            status: "REJECTED",
            decisionReason: b.reason,
            verifiedBy: s.user.id,
          },
        });
        await audit(t, s.user, "PAYMENT_REJECTED", id, { reason: b.reason });
        await notifyTenant(t, p.tenantId, "Payment rejected", b.reason);
        return { ok: true };
      }
      if (!b.receiptReference || b.receivedAmount !== p.amount)
        throw new BadRequestException(
          "Verified receipt and exact amount in paise required",
        );
      await lock(t, "tenant:" + p.tenantId);
      const payee = p.payeeSnapshot as any;
      const receiptKey =
        payee.upiId.toLowerCase() +
        ":" +
        b.receiptReference.trim().toUpperCase();
      await lock(t, "receipt:" + receiptKey);
      if (
        (await t.paymentRequest.findUnique({ where: { receiptKey } })) ||
        (await t.commerceOrder.findUnique({ where: { receiptKey } }))
      )
        throw new BadRequestException("Receipt already used");
      const previous = await t.subscription.findFirst({
        where: { tenantId: p.tenantId },
        orderBy: { endsAt: "desc" },
      });
      const terms = p.snapshot as any;
      const now = new Date();
      const active = await currentSub(p.tenantId, t);
      const upgrade = active && terms.amount > (active.snapshot as any).amount;
      if (upgrade && previous && previous.startsAt > now)
        throw new BadRequestException(
          "A renewal is already scheduled. Review it before approving an upgrade.",
        );
      if (upgrade && active) {
        await t.subscription.update({
          where: { id: active.id },
          data: { endsAt: now },
        });
        await t.creditGrant.updateMany({
          where: { subscriptionId: active.id },
          data: { expiresAt: now },
        });
      }
      const startsAt = upgrade
          ? now
          : renewalStart(previous?.endsAt || null, now),
        endsAt = new Date(startsAt.getTime() + terms.days * 86400000);
      const sub = await t.subscription.create({
        data: {
          tenantId: p.tenantId,
          planId: p.planId,
          snapshot: p.snapshot as Prisma.InputJsonValue,
          startsAt,
          endsAt,
          paymentId: p.id,
        },
      });
      const g = await t.creditGrant.create({
        data: {
          tenantId: p.tenantId,
          subscriptionId: sub.id,
          amount: terms.credits,
          remaining: terms.credits,
          expiresAt: endsAt,
        },
      });
      await t.creditTransaction.create({
        data: {
          tenantId: p.tenantId,
          grantId: g.id,
          delta: terms.credits,
          type: "PLAN_ALLOCATION",
          reference: p.id,
          actorId: s.user.id,
        },
      });
      await t.paymentRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          receiptKey,
          approvedAt: new Date(),
          verifiedBy: s.user.id,
          decisionReason: b.reason,
        },
      });
      await t.invoice.create({
        data: {
          tenantId: p.tenantId,
          paymentId: p.id,
          number: "CF-" + p.id,
          amount: p.amount,
        },
      });
      await audit(t, s.user, "PAYMENT_APPROVED", id, {
        amount: p.amount,
        receiptKey,
      });
      await notifyTenant(
        t,
        p.tenantId,
        "Payment approved",
        "Your subscription starts " + startsAt.toISOString().slice(0, 10),
      );
      return { ok: true };
    });
  }

  @Get("institution/profile") async institutionProfile(@Req() req: any) {
    const u = await tenantActor(req);
    const setting = await db.setting.findUnique({
      where: { key: "institution-profile:" + u.tenantId },
    });
    return {
      tenant: await db.tenant.findUniqueOrThrow({ where: { id: u.tenantId } }),
      profile: setting?.value || {
        type: "School",
        address: "",
        contactPerson: "",
        officialEmail: "",
        mobile: "",
        website: "",
        registrationDetails: "",
      },
    };
  }
  @Patch("institution/profile") async updateInstitutionProfile(
    @Req() req: any,
    @Body() body: any,
  ) {
    const s = await actor(req, ["TENANT_ADMIN"]);
    const b = z
      .object({
        name: z.string().min(2).max(150),
        recruitingProfessions:z.array(z.enum(["TEACHER","PHARMACIST"])).min(1).max(2).optional(),
        type: z.enum(["School", "College", "University", "Coaching", "Medical shop", "Hospital", "Other"]),
        address: z.string().max(1000),
        contactPerson: z.string().max(100),
        officialEmail: z.string().email(),
        mobile: z.string().max(25),
        website: z.string().max(200),
        registrationDetails: z.string().max(2000),
      })
      .parse(body);
    return tx(async (t) => {
      const old = await t.tenant.findUniqueOrThrow({
        where: { id: s.user.tenantId! },
      });
      await t.tenant.update({
        where: { id: old.id },
        data: {
          name: b.name,
          ...(b.recruitingProfessions?{recruitingProfessions:[...new Set(b.recruitingProfessions)]}:{}),
          verified: old.name === b.name ? old.verified : false,
        },
      });
      const { name, ...profile } = b;
      await t.setting.upsert({
        where: { key: "institution-profile:" + old.id },
        create: { key: "institution-profile:" + old.id, value: profile },
        update: { value: profile, version: { increment: 1 } },
      });
      await audit(t, s.user, "INSTITUTION_PROFILE_UPDATED", old.id);
      return { ok: true };
    });
  }
  @Post("admin/plans") async createPlan(@Req() req: any, @Body() body: any) {
    const s = await actor(req, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    const b = z
      .object({
        name: z.string().min(2).max(100),
        amount: z.number().int().min(0),
        days: z.number().int().min(1).max(366),
        credits: z.number().int().min(0),
        jobLimit: z.number().int().min(-1),
        searchLimit: z.number().int().min(-1),
        active: z.boolean(),
        creditExpiryPolicy: z.enum(["EXPIRE", "CARRY_FORWARD"]).optional(),
        carryForwardCap: z.number().int().min(0).nullable().optional(),
      })
      .parse(body);
    return tx(async (t) => {
      const plan = await t.plan.create({ data: b });
      await audit(t, s.user, "PLAN_CREATED", plan.id);
      return plan;
    });
  }

  @Get("institution/team") async team(@Req() req: any) {
    const s = await actor(req, ["TENANT_ADMIN"]);
    return db.user.findMany({
      where: { tenantId: s.user.tenantId },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }
  @Post("institution/team") async addRecruiter(
    @Req() req: any,
    @Body() body: any,
  ) {
    const s = await actor(req, ["TENANT_ADMIN"]);
    const b = z
      .object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(8).max(128),
      })
      .parse(body);
    return tx(async (t) => {
      const u = await t.user.create({
        data: {
          name: b.name,
          email: b.email.toLowerCase(),
          password: passwordHash(b.password),
          role: "RECRUITER",
          tenantId: s.user.tenantId,
        },
      });
      await audit(t, s.user, "TEAM_MEMBER_ADDED", u.id);
      return { id: u.id };
    });
  }
  @Patch("institution/team/:id") async toggleRecruiter(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["TENANT_ADMIN"]);
    const b = z.object({ active: z.boolean() }).parse(body);
    return tx(async (t) => {
      const result = await t.user.updateMany({
        where: { id, tenantId: s.user.tenantId, role: "RECRUITER" },
        data: b,
      });
      if (!result.count) throw new NotFoundException();
      if (!b.active) await t.session.deleteMany({ where: { userId: id } });
      await audit(t, s.user, "TEAM_MEMBER_STATUS", id, b);
      return { ok: true };
    });
  }
  @Get("admin/candidates") async moderateCandidates(@Req() req: any) {
    await actor(req, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    const rows = await db.candidate.findMany({
      take: 100,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            emailVerified: true,
            mobileVerified: true,
            active: true,
          },
        },
      },
    });
    return rows;
  }
  @Patch("admin/candidates/:id") async moderateCandidate(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const s = await actor(req, ["SUPER_ADMIN", "PLATFORM_ADMIN"]);
    const b = z
      .object({
        active: z.boolean().optional(),
        profileReviewed: z.boolean().optional(),
        revision: z.number().int().optional(),
      })
      .parse(body);
    return tx(async (t) => {
      await lock(t, "candidate:" + id);
      const c = await t.candidate.findUniqueOrThrow({ where: { id } });
      if (b.profileReviewed) await requireFee(t, { id: c.userId }, "PROFILE");
      if (b.profileReviewed && b.revision !== c.revision)
        throw new BadRequestException(
          "The profile changed. Refresh before approving.",
        );
      await t.candidate.update({
        where: { id },
        data: {
          profileReviewed: b.profileReviewed,
          ...(b.active === false ? { active: false } : {}),
        },
      });
      if (b.active !== undefined) {
        await t.user.update({
          where: { id: c.userId },
          data: { active: b.active },
        });
        if (!b.active)
          await t.session.deleteMany({ where: { userId: c.userId } });
      }
      await audit(t, s.user, "CANDIDATE_MODERATED", id, b);
      return { ok: true };
    });
  }
  @Get("institution/invoices/:id/pdf") async invoice(
    @Req() req: any,
    @Res() res: any,
    @Param("id") id: string,
  ) {
    const u = await tenantActor(req);
    const i = await db.invoice.findFirst({
      where: { id, tenantId: u.tenantId },
    });
    if (!i) throw new NotFoundException();
    const payment = await db.paymentRequest.findUniqueOrThrow({
      where: { id: i.paymentId },
    });
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: u.tenantId },
    });
    const doc = new PDFDocument({ margin: 50 });
    req.res.setHeader("Content-Type", "application/pdf");
    req.res.setHeader(
      "Content-Disposition",
      'attachment; filename="' + i.number + '.pdf"',
    );
    doc.pipe(res);
    doc.fontSize(25).text("CampusFaculty");
    doc.moveDown().fontSize(16).text("Payment receipt / invoice");
    doc
      .fontSize(11)
      .text("Reference: " + i.number)
      .text("Issued: " + i.createdAt.toISOString().slice(0, 10))
      .text("Institution: " + tenant.name)
      .text("Plan: " + (payment.snapshot as any).name)
      .text("Amount paid: INR " + (i.amount / 100).toFixed(2))
      .text("Method: Manual UPI")
      .moveDown()
      .text(
        "Tax treatment and statutory invoice particulars must be configured before production use.",
      );
    doc.end();
    return;
  }
  @Post("auth/verification/start") async startVerification(
    @Req() req: any,
    @Body() body: any,
  ) {
    const s = await actor(req);
    const b = z.object({ channel: z.enum(["EMAIL", "SMS"]) }).parse(body);
    const c = await db.candidate.findUnique({ where: { userId: s.user.id } });
    const destination = b.channel === "EMAIL" ? s.user.email : c?.mobile;
    if (!destination)
      throw new BadRequestException("Add a mobile number first");
    const recent = await db.verificationChallenge.findFirst({
      where: {
        userId: s.user.id,
        channel: b.channel,
        expiresAt: { gt: new Date(Date.now() + 8 * 60000) },
      },
    });
    if (recent)
      throw new BadRequestException("Wait before requesting another code");
    const url = process.env[b.channel + "_VERIFICATION_URL"];
    const key = process.env[b.channel + "_VERIFICATION_KEY"];
    if (!url || !key)
      throw new BadRequestException("Verification provider not configured");
    const code = String(randomInt(100000, 1000000));
    const challenge = await db.verificationChallenge.create({
      data: {
        userId: s.user.id,
        channel: b.channel,
        destination,
        hash: createHash("sha256")
          .update(s.user.id + code)
          .digest("hex"),
        expiresAt: new Date(Date.now() + 10 * 60000),
      },
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        destination,
        code,
        template: "campusfaculty-verification",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      await db.verificationChallenge.delete({ where: { id: challenge.id } });
      throw new BadRequestException("Verification delivery failed");
    }
    return { challengeId: challenge.id };
  }
  @Post("auth/verification/confirm") async confirmVerification(
    @Req() req: any,
    @Body() body: any,
  ) {
    const s = await actor(req);
    const b = z
      .object({ challengeId: z.string(), code: z.string().regex(/^\d{6}$/) })
      .parse(body);
    const result = await tx(async (t) => {
      await lock(t, "verification:" + b.challengeId);
      const c = await t.verificationChallenge.findFirst({
        where: {
          id: b.challengeId,
          userId: s.user.id,
          used: false,
          expiresAt: { gt: new Date() },
          attempts: { lt: 5 },
        },
      });
      if (!c) return false;
      await t.verificationChallenge.update({
        where: { id: c.id },
        data: { attempts: { increment: 1 } },
      });
      if (
        c.hash !==
        createHash("sha256")
          .update(s.user.id + b.code)
          .digest("hex")
      )
        return false;
      const candidate = await t.candidate.findUnique({
        where: { userId: s.user.id },
      });
      if (c.channel === "SMS" && candidate?.mobile !== c.destination)
        return false;
      await t.verificationChallenge.update({
        where: { id: c.id },
        data: { used: true },
      });
      await t.user.update({
        where: { id: s.user.id },
        data:
          c.channel === "EMAIL"
            ? { emailVerified: true }
            : { mobileVerified: true },
      });
      return true;
    });
    if (!result) throw new BadRequestException("Invalid or expired code");
    return { ok: true };
  }

  @Get("notifications") async notifications(@Req() req: any) {
    const s = await actor(req);
    return db.notification.findMany({
      where: { userId: s.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  @Patch("notifications/:id/read") async read(
    @Req() req: any,
    @Param("id") id: string,
  ) {
    const s = await actor(req);
    await db.notification.updateMany({
      where: { id, userId: s.user.id },
      data: { read: true },
    });
    return { ok: true };
  }
  @Get("institution/reports") async reports(@Req() req: any) {
    const u = await tenantActor(req);
    return {
      jobs: await db.job.count({ where: { tenantId: u.tenantId } }),
      applications: await db.application.count({
        where: { tenantId: u.tenantId },
      }),
      unlocks: await db.unlock.count({ where: { tenantId: u.tenantId } }),
      stages: await db.pipeline.groupBy({
        by: ["stage"],
        where: { tenantId: u.tenantId },
        _count: true,
      }),
    };
  }
}
@Module({ controllers: [Api] })
class AppModule {}
async function main() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN || "http://localhost:5182",
    credentials: true,
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== (process.env.WEB_ORIGIN || "http://localhost:5182")
    )
      return res.status(403).json({ message: "Invalid request origin" });
    const key =
      req.ip + ":" + (req.path.startsWith("/api/auth") ? "auth" : "api");
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.until < now)
      attempts.set(key, { count: 1, until: now + 60000 });
    else if (++entry.count > (req.path.startsWith("/api/auth") ? 20 : 300))
      return res.status(429).json({ message: "Too many requests" });
    if (attempts.size > 10000)
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
    next();
  });
  app.use(async (req: any, res: any, next: any) => {
    try {
      const token = req.cookies?.cf_session;
      const session = token
        ? await db.session.findUnique({
            where: { id: createHash("sha256").update(token).digest("hex") },
            include: { user: true },
          })
        : null;
      const candidate =
        session?.user.role === "CANDIDATE"
          ? await db.candidate.findUnique({
              where: { userId: session.userId },
              select: { id: true },
            })
          : null;
      scope.run(
        {
          role:
            session && session.expiresAt > new Date() && session.user.active
              ? session.user.role
              : "NONE",
          tenantId:
            session && session.expiresAt > new Date() && session.user.active
              ? session.user.tenantId || undefined
              : undefined,
          candidateId:
            session && session.expiresAt > new Date() && session.user.active
              ? candidate?.id
              : undefined,
        },
        () => next(),
      );
    } catch {
      res.status(500).json({ message: "Authentication service unavailable" });
    }
  });
  app.useGlobalFilters({
    catch(exception: any, host: any) {
      const res = host.switchToHttp().getResponse();
      if (exception instanceof z.ZodError)
        return res.status(400).json({
          message: exception.issues.map((i: any) => i.path.map((part:any)=>typeof part==="number"?"entry "+(part+1):String(part).replace(/([A-Z])/g," $1")).join(" → ")+": "+i.message).join("; "),
        });
      const status =
        exception.getStatus?.() || (exception.code === "P2002" ? 409 : 500);
      res.status(status).json({
        message:
          exception.code === "P2002"
            ? "A duplicate record already exists"
            : status === 500
              ? "Server error"
              : exception.message,
      });
    },
  });
  await app.listen(
    Number(process.env.PORT || 3001),
    process.env.API_HOST || "127.0.0.1",
  );
}
main();

