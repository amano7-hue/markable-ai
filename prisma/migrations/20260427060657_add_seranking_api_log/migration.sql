-- CreateTable
CREATE TABLE "SerankingApiLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "promptCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerankingApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SerankingApiLog_tenantId_idx" ON "SerankingApiLog"("tenantId");

-- CreateIndex
CREATE INDEX "SerankingApiLog_tenantId_createdAt_idx" ON "SerankingApiLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "SerankingApiLog" ADD CONSTRAINT "SerankingApiLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
