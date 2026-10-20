ALTER TABLE "Tenant" ADD COLUMN "generalCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Candidate" ADD COLUMN "generalDetails" JSONB NOT NULL DEFAULT '{}', ADD COLUMN "jobInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ADD COLUMN "category" TEXT, ADD COLUMN "requirements" JSONB NOT NULL DEFAULT '{}';
CREATE INDEX "Candidate_jobInterests_idx" ON "Candidate" USING GIN("jobInterests");
CREATE INDEX "Job_profession_category_status_idx" ON "Job"("profession","category","status");
