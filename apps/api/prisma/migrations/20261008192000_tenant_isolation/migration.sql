-- Apply AFTER the initial Prisma migration. Run with the migration role.
-- Use a non-superuser runtime login distinct from the migration owner.
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE OR REPLACE FUNCTION app_private.privileged() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('app.role',true) IN ('SUPER_ADMIN','PLATFORM_ADMIN','SYSTEM') $$;
CREATE OR REPLACE FUNCTION app_private.tenant_access(t text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT app_private.privileged() OR t = nullif(current_setting('app.tenant',true),'') $$;
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['Subscription','CreditGrant','CreditTransaction','Unlock','Pipeline','Note','Interview','PaymentRequest','Invoice','SearchSession'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_private.tenant_access("tenantId")) WITH CHECK (app_private.tenant_access("tenantId"))',tbl);
 END LOOP;
END $$;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "Tenant" FOR SELECT USING (app_private.tenant_access(id) OR current_setting('app.role',true)='CANDIDATE');
CREATE POLICY tenant_write ON "Tenant" FOR ALL USING (app_private.tenant_access(id)) WITH CHECK (app_private.tenant_access(id));
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" FORCE ROW LEVEL SECURITY;
CREATE POLICY job_read ON "Job" FOR SELECT USING (app_private.tenant_access("tenantId") OR (current_setting('app.role',true)='CANDIDATE' AND (status='PUBLISHED' OR EXISTS(SELECT 1 FROM "Application" a WHERE a."jobId"="Job".id AND a."candidateId"=nullif(current_setting('app.candidate',true),'')))));
CREATE POLICY job_write ON "Job" FOR ALL USING (app_private.tenant_access("tenantId")) WITH CHECK (app_private.tenant_access("tenantId"));
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" FORCE ROW LEVEL SECURITY;
CREATE POLICY application_access ON "Application" USING (app_private.tenant_access("tenantId") OR "candidateId"=nullif(current_setting('app.candidate',true),'')) WITH CHECK (app_private.tenant_access("tenantId") OR "candidateId"=nullif(current_setting('app.candidate',true),''));
ALTER TABLE "StatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatusHistory" FORCE ROW LEVEL SECURITY;
CREATE POLICY history_access ON "StatusHistory" USING (EXISTS(SELECT 1 FROM "Application" a WHERE a.id="applicationId")) WITH CHECK (EXISTS(SELECT 1 FROM "Application" a WHERE a.id="applicationId"));
-- Candidate submission inserts its own pipeline, but may not read tenant notes or pipeline records.
CREATE POLICY candidate_pipeline_insert ON "Pipeline" FOR ALL USING ("candidateId"=nullif(current_setting('app.candidate',true),'') AND source='JOB_APPLICATION') WITH CHECK ("candidateId"=nullif(current_setting('app.candidate',true),'') AND source='JOB_APPLICATION' AND EXISTS(SELECT 1 FROM "Application" a WHERE a.id="Pipeline"."applicationId" AND a."tenantId"="Pipeline"."tenantId" AND a."candidateId"="Pipeline"."candidateId"));
ALTER TABLE "Application" ADD CONSTRAINT application_job_tenant_check UNIQUE (id,"tenantId");
ALTER TABLE "Job" ADD CONSTRAINT job_id_tenant_unique UNIQUE (id,"tenantId");
ALTER TABLE "Application" ADD CONSTRAINT application_job_same_tenant FOREIGN KEY ("jobId","tenantId") REFERENCES "Job"(id,"tenantId");
ALTER TABLE "Pipeline" ADD CONSTRAINT pipeline_application_same_tenant FOREIGN KEY ("applicationId","tenantId") REFERENCES "Application"(id,"tenantId");
ALTER TABLE "Pipeline" ADD CONSTRAINT pipeline_id_tenant_unique UNIQUE (id,"tenantId");
ALTER TABLE "Note" ADD CONSTRAINT note_pipeline_same_tenant FOREIGN KEY ("pipelineId","tenantId") REFERENCES "Pipeline"(id,"tenantId");
ALTER TABLE "Interview" ADD CONSTRAINT interview_pipeline_same_tenant FOREIGN KEY ("pipelineId","tenantId") REFERENCES "Pipeline"(id,"tenantId");
