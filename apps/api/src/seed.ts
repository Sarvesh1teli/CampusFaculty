import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
const db = new PrismaClient();
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12)
    throw Error("Set SEED_ADMIN_PASSWORD to at least 12 characters");
  const salt = randomBytes(16).toString("hex");
  await db.user.upsert({
    where: {
      email: process.env.SEED_ADMIN_EMAIL || "owner@campusfaculty.local",
    },
    update: {},
    create: {
      email: process.env.SEED_ADMIN_EMAIL || "owner@campusfaculty.local",
      name: "TeliCareers Owner",
      role: "SUPER_ADMIN",
      password: salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    },
  });
  await db.setting.upsert({
    where: { key: "simple_pricing" },
    update: {},
    create: {
      key: "simple_pricing",
      value: {
        enabled: true,
        profileFee: 0,
        applicationFee: 0,
        jobFee: 0,
        unlockPaid: true,
        packPrice: 20000,
        packCredits: 5,
        validityDays: 365,
      },
    },
  });
  await db.setting.upsert({where:{key:"teacher_auto_approve_enabled"},update:{},create:{key:"teacher_auto_approve_enabled",value:false}});
  for (const plan of [
    {
      id: "free",
      name: "Starter",
      amount: 0,
      credits: 3,
      jobLimit: 1,
      searchLimit: 5,
    },
    {
      id: "school",
      name: "School",
      amount: 99900,
      credits: 15,
      jobLimit: 5,
      searchLimit: -1,
    },
    {
      id: "growth",
      name: "Growth",
      amount: 249900,
      credits: 50,
      jobLimit: 15,
      searchLimit: -1,
    },
  ])
    await db.plan.upsert({ where: { id: plan.id }, update: {}, create: plan });
  for (const key of [
    "institution_job_posting_enabled",
    "candidate_job_search_enabled",
    "candidate_job_applications_enabled",
    "institution_candidate_search_enabled",
    "institution_candidate_unlock_enabled",
  ])
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: true },
    });
  await db.setting.upsert({
    where: { key: "payment" },
    update: {},
    create: {
      key: "payment",
      value: {
        method: "MANUAL_UPI",
        upiId: "",
        payeeName: "",
        qrAsset: "",
        enabled: false,
      },
    },
  });
  for (const [key, value] of [
    ["expired_subscription_job_policy", "KEEP_UNTIL_CLOSE"],
    ["reapply_waiting_days", 30],
  ] as const)
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  console.log("Seed complete. Manual UPI remains disabled until configured.");
}
main().finally(() => db.$disconnect());
