ALTER TABLE "Candidate" ADD COLUMN "jobSeeking" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "UnavailableReport" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "candidateId" TEXT NOT NULL,
 "unlockId" TEXT NOT NULL UNIQUE REFERENCES "Unlock"(id), "reportedBy" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "restoreCredit" BOOLEAN NOT NULL DEFAULT false, "markUnavailable" BOOLEAN NOT NULL DEFAULT false,
 "decisionReason" TEXT, "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("tenantId", "candidateId") REFERENCES "Unlock"("tenantId", "candidateId")
);
CREATE INDEX "UnavailableReport_status_createdAt_idx" ON "UnavailableReport"("status", "createdAt");
CREATE INDEX "UnavailableReport_tenantId_createdAt_idx" ON "UnavailableReport"("tenantId", "createdAt");
ALTER TABLE "UnavailableReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnavailableReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY report_tenant_isolation ON "UnavailableReport" USING (app_private.tenant_access("tenantId")) WITH CHECK (app_private.tenant_access("tenantId"));
