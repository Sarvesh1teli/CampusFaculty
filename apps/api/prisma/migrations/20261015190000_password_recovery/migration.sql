CREATE TABLE "PasswordResetChallenge" ("id" TEXT PRIMARY KEY,"userId" TEXT,"emailKey" TEXT NOT NULL,"ipKey" TEXT NOT NULL,"codeHash" TEXT NOT NULL,"passwordVersion" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"attempts" INTEGER NOT NULL DEFAULT 0,"used" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "PasswordResetChallenge_emailKey_createdAt_idx" ON "PasswordResetChallenge"("emailKey","createdAt");
CREATE INDEX "PasswordResetChallenge_ipKey_createdAt_idx" ON "PasswordResetChallenge"("ipKey","createdAt");
CREATE INDEX "PasswordResetChallenge_userId_used_idx" ON "PasswordResetChallenge"("userId","used");
CREATE INDEX "PasswordResetChallenge_expiresAt_idx" ON "PasswordResetChallenge"("expiresAt");
