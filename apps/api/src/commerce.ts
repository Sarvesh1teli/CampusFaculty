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
  return s?.value || null;
}
export async function requireFee(t: any, u: any, kind: string, target = "") {
  const cfg = await pricing(t);
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
  const order = await t.commerceOrder.findFirst({
    where: {
      ...(kind === "JOB" ? { tenantId: u.tenantId } : { userId: u.id }),
      kind,
      target,
      status: "APPROVED",
      ...(kind === "PROFILE" ? {} : { consumedAt: null }),
    },
    orderBy: { createdAt: "asc" },
  });
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
) {
  const cfg = await pricing(t);
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
    const existing = await t.commerceOrder.findFirst({
      where: {
        userId: u.id,
        kind,
        target,
        status: { in: ["AWAITING_PAYMENT", "UNDER_REVIEW", "APPROVED"] },
        ...(kind === "PROFILE" ? {} : { consumedAt: null }),
      },
    });
    if (existing) return existing;
  }
  const subtotal = unit * quantity;
  const snapshot = {
    kind,
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
