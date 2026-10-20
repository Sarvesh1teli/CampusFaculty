ALTER TABLE "Job" ADD COLUMN "salaryMax" INTEGER;
ALTER TABLE "Job" ADD CONSTRAINT "Job_salary_range_check" CHECK ("salaryMax" IS NULL OR "salaryMax">="salary");
