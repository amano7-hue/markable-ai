-- SeoKeyword と SeoKeywordSnapshot をプロジェクト別に変更（データは再同期可能）
TRUNCATE TABLE "SeoKeywordSnapshot";
TRUNCATE TABLE "SeoKeyword" CASCADE;
DROP INDEX IF EXISTS "SeoKeyword_tenantId_text_key";
CREATE UNIQUE INDEX "SeoKeyword_tenantId_projectId_text_key" ON "SeoKeyword"("tenantId", "projectId", "text");
DROP INDEX IF EXISTS "SeoKeywordSnapshot_tenantId_keywordId_snapshotDate_key";
CREATE UNIQUE INDEX "SeoKeywordSnapshot_tenantId_projectId_keywordId_snapshotDate_ke" ON "SeoKeywordSnapshot"("tenantId", "projectId", "keywordId", "snapshotDate");
