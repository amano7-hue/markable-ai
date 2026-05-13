-- Ga4DailyMetric: 既存データを削除（GA4 API から再同期可能）してプロジェクト別に変更
TRUNCATE TABLE "Ga4DailyMetric";

-- DropIndex
DROP INDEX "Ga4DailyMetric_tenantId_date_idx";

-- DropIndex
DROP INDEX "Ga4DailyMetric_tenantId_date_key";

-- AlterTable: projectId を NOT NULL に変更
ALTER TABLE "Ga4DailyMetric" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex: プロジェクト別ユニーク制約
CREATE UNIQUE INDEX "Ga4DailyMetric_tenantId_projectId_date_key" ON "Ga4DailyMetric"("tenantId", "projectId", "date");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_projectId_idx" ON "Ga4DailyMetric"("projectId");

-- NurtureLead: projectId 追加
ALTER TABLE "NurtureLead" ADD COLUMN "projectId" TEXT;

-- NurtureSegment: projectId 追加
ALTER TABLE "NurtureSegment" ADD COLUMN "projectId" TEXT;

-- NurtureEmailDraft: projectId 追加
ALTER TABLE "NurtureEmailDraft" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "NurtureLead_projectId_idx" ON "NurtureLead"("projectId");

-- CreateIndex
CREATE INDEX "NurtureSegment_projectId_idx" ON "NurtureSegment"("projectId");

-- CreateIndex
CREATE INDEX "NurtureEmailDraft_projectId_idx" ON "NurtureEmailDraft"("projectId");

-- AddForeignKey
ALTER TABLE "NurtureLead" ADD CONSTRAINT "NurtureLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureSegment" ADD CONSTRAINT "NurtureSegment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurtureEmailDraft" ADD CONSTRAINT "NurtureEmailDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
