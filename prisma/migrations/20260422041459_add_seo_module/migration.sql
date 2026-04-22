-- CreateTable
CREATE TABLE "GscConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GscConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeyword" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "intent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeywordSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keywordId" TEXT,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "draft" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "SeoArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GscConnection_tenantId_key" ON "GscConnection"("tenantId");

-- CreateIndex
CREATE INDEX "SeoKeyword_tenantId_idx" ON "SeoKeyword"("tenantId");

-- CreateIndex
CREATE INDEX "SeoKeyword_tenantId_isActive_idx" ON "SeoKeyword"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_tenantId_text_key" ON "SeoKeyword"("tenantId", "text");

-- CreateIndex
CREATE INDEX "SeoKeywordSnapshot_tenantId_idx" ON "SeoKeywordSnapshot"("tenantId");

-- CreateIndex
CREATE INDEX "SeoKeywordSnapshot_tenantId_keywordId_idx" ON "SeoKeywordSnapshot"("tenantId", "keywordId");

-- CreateIndex
CREATE INDEX "SeoKeywordSnapshot_tenantId_snapshotDate_idx" ON "SeoKeywordSnapshot"("tenantId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeywordSnapshot_tenantId_keywordId_snapshotDate_key" ON "SeoKeywordSnapshot"("tenantId", "keywordId", "snapshotDate");

-- CreateIndex
CREATE INDEX "SeoArticle_tenantId_idx" ON "SeoArticle"("tenantId");

-- CreateIndex
CREATE INDEX "SeoArticle_tenantId_status_idx" ON "SeoArticle"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "GscConnection" ADD CONSTRAINT "GscConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeywordSnapshot" ADD CONSTRAINT "SeoKeywordSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeywordSnapshot" ADD CONSTRAINT "SeoKeywordSnapshot_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoArticle" ADD CONSTRAINT "SeoArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoArticle" ADD CONSTRAINT "SeoArticle_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
