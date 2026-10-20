import "dotenv/config";
import { Prisma } from "@prisma/client";
import { db, base, scope } from "./database";
async function tick() {
  const now = new Date();
  await db.passwordResetChallenge.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-7*86400000)}}});
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const grants = await db.creditGrant.findMany({
    where: { expiresAt: { lte: now }, remaining: { gt: 0 } },
  });
  for (const grant of grants) {
    try {
      await base.$transaction(
        async (t) => {
          await t.$queryRawUnsafe(
            "SELECT set_config('app.role','SYSTEM',true)",
          );
          await t.$queryRawUnsafe(
            "SELECT pg_advisory_xact_lock(hashtext($1))::text",
            "tenant:" + grant.tenantId,
          );
          const g = await t.creditGrant.findUniqueOrThrow({
            where: { id: grant.id },
          });
          if (!g.remaining) return;
          if (g.subscriptionId.startsWith("pack:")) {
            await t.creditTransaction.create({
              data: {
                tenantId: g.tenantId,
                grantId: g.id,
                delta: -g.remaining,
                type: "PACK_EXPIRY",
                reference: "expire:" + g.id,
                actorId: "SYSTEM",
              },
            });
            await t.creditGrant.update({
              where: { id: g.id },
              data: { remaining: 0 },
            });
            return;
          }
          const old = await t.subscription.findUniqueOrThrow({
            where: { id: g.subscriptionId },
          });
          const terms = old.snapshot as any;
          const next = await t.subscription.findFirst({
            where: {
              tenantId: g.tenantId,
              startsAt: { gte: old.endsAt, lte: now },
            },
            orderBy: { startsAt: "asc" },
          });
          if (terms.creditExpiryPolicy === "CARRY_FORWARD" && !next) return;
          const previousCarry = next
            ? await t.creditTransaction.findMany({
                where: {
                  tenantId: g.tenantId,
                  type: "CARRY_FORWARD",
                  reference: { endsWith: ":" + next.id },
                },
              })
            : [];
          const carried = previousCarry.reduce(
            (total, row) => total + row.delta,
            0,
          );
          let carry =
            terms.creditExpiryPolicy === "CARRY_FORWARD"
              ? Math.min(
                  g.remaining,
                  terms.carryForwardCap === null ||
                    terms.carryForwardCap === undefined
                    ? g.remaining
                    : Math.max(0, terms.carryForwardCap - carried),
                )
              : 0;
          await t.creditTransaction.create({
            data: {
              tenantId: g.tenantId,
              grantId: g.id,
              delta: -g.remaining,
              type: "EXPIRY",
              reference: "expiry:" + g.id,
              actorId: "SYSTEM",
            },
          });
          await t.creditGrant.update({
            where: { id: g.id },
            data: { remaining: 0 },
          });
          if (carry && next) {
            const ng = await t.creditGrant.create({
              data: {
                tenantId: g.tenantId,
                subscriptionId: next.id,
                amount: carry,
                remaining: carry,
                expiresAt: next.endsAt,
              },
            });
            await t.creditTransaction.create({
              data: {
                tenantId: g.tenantId,
                grantId: ng.id,
                delta: carry,
                type: "CARRY_FORWARD",
                reference: "carry:" + g.id + ":" + next.id,
                actorId: "SYSTEM",
              },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (!["P2034", "P2002"].includes(e.code))
        console.error("Grant processing failed", grant.id);
    }
  }
  const subscriptions = await db.subscription.findMany({
    where: {
      startsAt: { lte: now },
      endsAt: {
        gte: new Date(now.getTime() - 86400000),
        lte: new Date(now.getTime() + 30 * 86400000),
      },
    },
  });
  for (const s of subscriptions) {
    const days = Math.ceil((s.endsAt.getTime() - now.getTime()) / 86400000);
    if (![30, 15, 7, 3, 1, 0].includes(days)) continue;
    const reference = "renewal:" + s.id + ":" + days;
    await db.$transaction(async (t) => {
      await t.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))::text",
        reference,
      );
      if (
        await t.audit.findFirst({
          where: { entityId: reference, action: "RENEWAL_NOTICE" },
        })
      )
        return;
      const users = await t.user.findMany({
        where: { tenantId: s.tenantId, active: true },
      });
      await t.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          tenantId: s.tenantId,
          title:
            days === 0 ? "Subscription expired" : "Subscription ending soon",
          body:
            days === 0
              ? "Renew to post new jobs and unlock new contacts. Existing applications remain accessible."
              : "Your plan expires in " + days + " days.",
        })),
      });
      await t.audit.create({
        data: {
          actorId: "SYSTEM",
          tenantId: s.tenantId,
          entityId: reference,
          action: "RENEWAL_NOTICE",
          details: { days },
        },
      });
    });
  }
}
let running = false;
async function run() {
  if (running) return;
  running = true;
  try {
    await scope.run({ role: "SYSTEM" }, () => tick());
  } catch {
    console.error("Worker cycle failed");
  } finally {
    running = false;
  }
}
run();
setInterval(run, 60000);
process.on("SIGINT", () => db.$disconnect().then(() => process.exit()));
