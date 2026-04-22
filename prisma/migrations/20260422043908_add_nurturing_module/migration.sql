-- CreateTable
CREATE TABLE "HubSpotConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HubSpotConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurtureLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hubspotId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "lifecycle" TEXT,
    "leadStatus" TEXT,
    "icpScore" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurtureLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurtureSegment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurtureSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurtureLeadSegment" (
    "leadId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,

    CONSTRAINT "NurtureLeadSegment_pkey" PRIMARY KEY ("leadId","segmentId")
);

-- CreateTable
CREATE TABLE "NurtureEmailDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "segmentId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "NurtureEmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HubSpotConnection_tenantId_key" ON "HubSpotConnection"("tenantId");

-- CreateIndex
CREATE INDEX "NurtureLead_tenantId_idx" ON "NurtureLead"("tenantId");

-- CreateIndex
CREATE INDEX "NurtureLead_tenantId_lifecycle_idx" ON "NurtureLead"("tenantId", "lifecycle");

-- CreateIndex
CREATE INDEX "NurtureLead_tenantId_icpScore_idx" ON "NurtureLead"("tenantId", "icpScore");

-- CreateIndex
CREATE UNIQUE INDEX "NurtureLead_tenantId_hubspotId_key" ON "NurtureLead"("tenantId", "hubspotId");

-- CreateIndex
CREATE INDEX "NurtureSegment_tenantId_idx" ON "NurtureSegment"("tenantId");

-- CreateIndex
CREATE INDEX "NurtureEmailDraft_tenantId_idx" ON "NurtureEmailDraft"("tenantId");

-- CreateIndex
CREATE INDEX "NurtureEmailDraft_tenantId_status_idx" ON "NurtureEmailDraft"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "HubSpotConnection" ADD CONSTRAINT "HubSpotConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureLead" ADD CONSTRAINT "NurtureLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureSegment" ADD CONSTRAINT "NurtureSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureLeadSegment" ADD CONSTRAINT "NurtureLeadSegment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "NurtureLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureLeadSegment" ADD CONSTRAINT "NurtureLeadSegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "NurtureSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureEmailDraft" ADD CONSTRAINT "NurtureEmailDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureEmailDraft" ADD CONSTRAINT "NurtureEmailDraft_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "NurtureSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
