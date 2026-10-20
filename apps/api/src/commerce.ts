import {generalConfig,eligibility} from "./general";
import { canReapply } from "./policy";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
export const defaultPricing = {
  enabled: true,
  profileFee: 0,
  applicationFee: 0,
  jobFee: 0,
  unlockPaid: true,
  packPrice: 20000,
  packCredits: 5,
  validityDays: 365,
};
export async function pricing(t: any) {
  const s = await t.setting.findUnique({ where: { key: "simple_pricing" } });
  return s?.value || defaultPricing;
}
export async function creditPricing(t:any,profession="TEACHER") {
 if(profession==="GENERAL")return {...await generalConfig(t),enabled:true};
 if(profession==="TEACHER")return pricing(t);
 const s=await t.setting.findUnique({where:{key:"credit_pricing:"+profession}});
 return s?.value||{enabled:true,unlockPaid:true,packPrice:20000,packCredits:5,validityDays:365};
}
export async function requireFee(t: any, u: any, kind: string, target = "",profession?:string) {
  if(!profession&&u.role==="CANDIDATE")profession=(await t.candidate.findUnique({where:{userId:u.id}}))?.profession;
  const cfg = profession==="GENERAL"?{...await generalConfig(t),enabled:true}:await pricing(t);
  if (!cfg?.enabled) return;
  if (
    kind === "PROFILE" &&
    (
      await t.setting.findUnique({
        where: { key: "profile-activation:" + u.id },
      })
    )?.value === true
  )
    return;
  const fee =
    kind === "PROFILE"
      ? cfg.profileFee
      : kind === "APPLICATION"
        ? cfg.applicationFee
        : cfg.jobFee;
  if (!fee) return;
  await t.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))::text",
    "fee:" + (kind === "JOB" ? u.tenantId : u.id),
  );
  const feeOrders = await t.commerceOrder.findMany({
    where: {
      ...(kind === "JOB" ? { tenantId: u.tenantId } : { userId: u.id }),
      kind,

      target,
      status: "APPROVED",
      ...(kind === "PROFILE" ? {} : { consumedAt: null }),
    },
    orderBy: { createdAt: "asc" },
  });
  const order=feeOrders.find((o:any)=>profession==="GENERAL"?o.snapshot.profession==="GENERAL":o.snapshot.profession!=="GENERAL");
  if (!order)
    throw new ForbiddenException(
      "Payment approval required. Open Payments to purchase " +
        (kind === "PROFILE"
          ? "profile activation"
          : kind === "APPLICATION"
            ? "this application fee"
            : "a job posting fee") +
        ".",
    );
  if (!order.consumedAt)
    await t.commerceOrder.update({
      where: { id: order.id },
      data: { consumedAt: new Date() },
    });
}
export async function createOrder(
  t: any,
  u: any,
  kind: string,
  quantity: number,
  target: string,
  profession="TEACHER",
) {
  if(u.role==="CANDIDATE")profession=(await t.candidate.findUnique({where:{userId:u.id}}))?.profession||profession;
  const cfg = kind==="UNLOCK_PACK"?await creditPricing(t,profession):profession==="GENERAL"?{...await generalConfig(t),enabled:true}:await pricing(t);
  if(kind==="UNLOCK_PACK"||kind==="JOB"){const tenant=await t.tenant.findUnique({where:{id:u.tenantId}});if(!tenant?.recruitingProfessions.includes(profession))throw new ForbiddenException("Profession not selected by your institution");}
  if (
    kind === "PROFILE" &&
    (
      await t.setting.findUnique({
        where: { key: "profile-activation:" + u.id },
      })
    )?.value === true
  )
    throw new BadRequestException("Your profile is already activated");
  const feature =
    kind === "APPLICATION"
      ? "candidate_job_applications_enabled"
      : kind === "JOB"
        ? "institution_job_posting_enabled"
        : null;
  if (
    feature &&
    (await t.setting.findUnique({ where: { key: feature } }))?.value !== true
  )
    throw new ForbiddenException("Feature disabled");
  if (!cfg?.enabled)
    throw new BadRequestException("Simple pricing is not configured");
  if (
    (kind === "UNLOCK_PACK" && !u.tenantId) ||
    (kind === "JOB" && !u.tenantId) ||
    (["PROFILE", "APPLICATION"].includes(kind) && u.role !== "CANDIDATE")
  )
    throw new ForbiddenException();
  let candidateId: string | null = null;
  if (u.role === "CANDIDATE")
    candidateId = (
      await t.candidate.findUniqueOrThrow({ where: { userId: u.id } })
    ).id;
  if (kind === "APPLICATION") {
    await t.$queryRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))::text",
      "application:" + target + ":" + candidateId,
    );
    const job = await t.job.findUnique({ where: { id: target } });
    if (!job || job.status !== "PUBLISHED" || job.closesAt <= new Date())
      throw new BadRequestException("Job is closed");
    const candidate=await t.candidate.findUniqueOrThrow({where:{id:candidateId}});if(candidate.profession!==job.profession)throw new ForbiddenException("This vacancy is for a different profession");const match=eligibility(candidate,job);if(!match.eligible)throw new ForbiddenException(match.reason);
    const a = await t.application.findFirst({
      where: { jobId: target, candidateId },
      orderBy: { attempt: "desc" },
    });
    const wait =
      (await t.setting.findUnique({ where: { key: "reapply_waiting_days" } }))
        ?.value ?? 30;
    if (a && !canReapply(a.status, a.closedAt, new Date(), wait))
      throw new BadRequestException(
        "An active application or waiting period prevents this purchase",
      );
    target = target + ":" + ((a?.attempt || 0) + 1);
  }
  const unit =
    kind === "UNLOCK_PACK"
      ? cfg.packPrice
      : kind === "PROFILE"
        ? cfg.profileFee
        : kind === "APPLICATION"
          ? cfg.applicationFee
          : cfg.jobFee;
  if (!unit || (kind === "UNLOCK_PACK" && !cfg.unlockPaid))
    throw new BadRequestException("This feature is free");
  const payee = (await t.setting.findUnique({ where: { key: "payment" } }))
    ?.value;
  if (!payee?.enabled)
    throw new BadRequestException("Manual UPI collections are not configured");
  await t.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))::text",
    "order:" + u.id,
  );
  if (kind !== "UNLOCK_PACK") {
    const existingOrders = await t.commerceOrder.findMany({
      where: {
        userId: u.id,
        kind,
        ...(profession==="GENERAL"?{snapshot:{path:["profession"],equals:"GENERAL"}}:{}),
        target,
        status: { in: ["AWAITING_PAYMENT", "UNDER_REVIEW", "APPROVED"] },
        ...(kind === "PROFILE" ? {} : { consumedAt: null }),
      },
    });
    const existing=existingOrders.find((o:any)=>profession==="GENERAL"?o.snapshot.profession==="GENERAL":o.snapshot.profession!=="GENERAL");
      if (existing) return existing;
  }
  const subtotal = unit * quantity;
  const snapshot = {
    kind,
    profession,
    quantity,
    unitPrice: unit,
    credits: kind === "UNLOCK_PACK" ? cfg.packCredits * quantity : 0,
    validityDays: cfg.validityDays,
  };
  return t.commerceOrder.create({
    data: {
      userId: u.id,
      tenantId: u.tenantId || null,
      candidateId,
      kind,
      target,
      snapshot,
      subtotal,
      amount: subtotal,
      payeeSnapshot: payee,
    },
  });
}
