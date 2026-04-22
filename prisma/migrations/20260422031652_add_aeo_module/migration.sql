-- CreateEnum
CREATE TYPE "AeoEngine" AS ENUM ('CHATGPT', 'PERPLEXITY', 'GEMINI', 'GOOGLE_AI_OVERVIEW');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "ownDomain" TEXT,
ADD COLUMN     "serankingProjectId" TEXT;

-- CreateTable
CREATE TABLE "AeoPrompt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "serankingPromptId" TEXT,
    "industry" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AeoPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AeoCompetitor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AeoCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AeoRankSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "engine" "AeoEngine" NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "ownDomain" TEXT,
    "ownRank" INTEGER,
    "citations" JSONB NOT NULL,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AeoRankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "ApprovalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AeoPrompt_tenantId_idx" ON "AeoPrompt"("tenantId");

-- CreateIndex
CREATE INDEX "AeoPrompt_tenantId_isActive_idx" ON "AeoPrompt"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "AeoCompetitor_tenantId_idx" ON "AeoCompetitor"("tenantId");

-- CreateIndex
CREATE INDEX "AeoCompetitor_promptId_idx" ON "AeoCompetitor"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "AeoCompetitor_tenantId_promptId_domain_key" ON "AeoCompetitor"("tenantId", "promptId", "domain");

-- CreateIndex
CREATE INDEX "AeoRankSnapshot_tenantId_idx" ON "AeoRankSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "AeoRankSnapshot_tenantId_promptId_idx" ON "AeoRankSnapshot"("tenantId", "promptId");

-- CreateIndex
CREATE INDEX "AeoRankSnapshot_tenantId_snapshotDate_idx" ON "AeoRankSnapshot"("tenantId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "AeoRankSnapshot_tenantId_promptId_engine_snapshotDate_key" ON "AeoRankSnapshot"("tenantId", "promptId", "engine", "snapshotDate");

-- CreateIndex
CREATE INDEX "ApprovalItem_tenantId_idx" ON "ApprovalItem"("tenantId");

-- CreateIndex
CREATE INDEX "ApprovalItem_tenantId_status_idx" ON "ApprovalItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ApprovalItem_tenantId_module_idx" ON "ApprovalItem"("tenantId", "module");

-- AddForeignKey
ALTER TABLE "AeoPrompt" ADD CONSTRAINT "AeoPrompt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeoCompetitor" ADD CONSTRAINT "AeoCompetitor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeoCompetitor" ADD CONSTRAINT "AeoCompetitor_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AeoPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeoRankSnapshot" ADD CONSTRAINT "AeoRankSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeoRankSnapshot" ADD CONSTRAINT "AeoRankSnapshot_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AeoPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalItem" ADD CONSTRAINT "ApprovalItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
