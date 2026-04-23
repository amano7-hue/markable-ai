-- CreateTable
CREATE TABLE "Ga4Connection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ga4Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ga4DailyMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "users" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "organicSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ga4DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ga4Connection_tenantId_key" ON "Ga4Connection"("tenantId");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_tenantId_idx" ON "Ga4DailyMetric"("tenantId");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_tenantId_date_idx" ON "Ga4DailyMetric"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Ga4DailyMetric_tenantId_date_key" ON "Ga4DailyMetric"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "Ga4Connection" ADD CONSTRAINT "Ga4Connection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ga4DailyMetric" ADD CONSTRAINT "Ga4DailyMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
