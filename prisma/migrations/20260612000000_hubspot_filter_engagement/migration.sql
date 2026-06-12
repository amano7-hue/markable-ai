-- AlterTable HubSpotConnection: add importFilter
ALTER TABLE "HubSpotConnection" ADD COLUMN "importFilter" JSONB;

-- AlterTable NurtureLead: add email engagement fields
ALTER TABLE "NurtureLead" ADD COLUMN "emailOpenCount" INTEGER DEFAULT 0;
ALTER TABLE "NurtureLead" ADD COLUMN "emailClickCount" INTEGER DEFAULT 0;
ALTER TABLE "NurtureLead" ADD COLUMN "lastEmailOpenAt" TIMESTAMP(3);

-- CreateTable AeoProjectCompetitor
CREATE TABLE "AeoProjectCompetitor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AeoProjectCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AeoProjectCompetitor_projectId_domain_key" ON "AeoProjectCompetitor"("projectId", "domain");
CREATE INDEX "AeoProjectCompetitor_tenantId_idx" ON "AeoProjectCompetitor"("tenantId");
CREATE INDEX "AeoProjectCompetitor_projectId_idx" ON "AeoProjectCompetitor"("projectId");

-- AddForeignKey
ALTER TABLE "AeoProjectCompetitor" ADD CONSTRAINT "AeoProjectCompetitor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AeoProjectCompetitor" ADD CONSTRAINT "AeoProjectCompetitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
