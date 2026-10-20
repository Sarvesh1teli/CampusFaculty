ALTER TABLE "CreditGrant" ADD COLUMN "profession" TEXT NOT NULL DEFAULT 'TEACHER';
ALTER TABLE "CreditTransaction" ADD COLUMN "profession" TEXT NOT NULL DEFAULT 'TEACHER';
CREATE INDEX "CreditGrant_tenantId_profession_expiresAt_idx" ON "CreditGrant"("tenantId","profession","expiresAt");
INSERT INTO "Setting"("key","value") SELECT 'credit_pricing:'||p, jsonb_build_object('enabled',true,'unlockPaid',COALESCE("value"->'unlockPaid','true'::jsonb),'packPrice',COALESCE("value"->'packPrice','20000'::jsonb),'packCredits',COALESCE("value"->'packCredits','5'::jsonb),'validityDays',COALESCE("value"->'validityDays','365'::jsonb)) FROM "Setting",unnest(ARRAY['PHARMACIST','NURSE']) p WHERE "key"='simple_pricing' ON CONFLICT ("key") DO NOTHING;
