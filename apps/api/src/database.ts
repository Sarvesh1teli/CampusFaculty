import { PrismaClient, Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";
export const scope = new AsyncLocalStorage<{
  role: string;
  tenantId?: string;
  candidateId?: string;
}>();
export const base = new PrismaClient();
export async function setScope(t: Prisma.TransactionClient) {
  const s = scope.getStore() || { role: "NONE" };
  await t.$queryRawUnsafe(
    "SELECT set_config('app.role',$1,true), set_config('app.tenant',$2,true), set_config('app.candidate',$3,true)",
    s.role,
    s.tenantId || "",
    s.candidateId || "",
  );
}
const protectedModels = [
  "UnavailableReport",
  "CommerceOrder",
  "Tenant",
  "Subscription",
  "CreditGrant",
  "CreditTransaction",
  "Unlock",
  "Job",
  "Application",
  "Pipeline",
  "StatusHistory",
  "Note",
  "Interview",
  "PaymentRequest",
  "Invoice",
  "SearchSession",
];
export const db = base.$extends({
  query: {
    $allModels: {
      $allOperations: async ({ model, operation, args, query }) => {
        if (!protectedModels.includes(model)) return query(args);
        return base.$transaction(async (t) => {
          await setScope(t);
          const name = model.charAt(0).toLowerCase() + model.slice(1);
          return (t as any)[name][operation](args);
        });
      },
    },
  },
});
