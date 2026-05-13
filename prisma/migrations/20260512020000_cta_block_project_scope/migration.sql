-- AlterTable: CtaBlock に projectId を追加
ALTER TABLE "CtaBlock" ADD COLUMN "projectId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "CtaBlock_tenantId_shortcode_key";

-- CreateIndex: プロジェクト別ユニーク制約
CREATE UNIQUE INDEX "CtaBlock_tenantId_projectId_shortcode_key" ON "CtaBlock"("tenantId", "projectId", "shortcode");

-- CreateIndex
CREATE INDEX "CtaBlock_projectId_idx" ON "CtaBlock"("projectId");

-- AddForeignKey
ALTER TABLE "CtaBlock" ADD CONSTRAINT "CtaBlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
