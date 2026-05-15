-- SeoArticle に featuredImageUrl を追加
ALTER TABLE "SeoArticle" ADD COLUMN IF NOT EXISTS "featuredImageUrl" TEXT;

-- SeoArticleDiagram テーブルを作成
CREATE TABLE IF NOT EXISTS "SeoArticleDiagram" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "articleId"   TEXT NOT NULL,
    "marker"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "mermaidCode" TEXT NOT NULL,
    "imageUrl"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoArticleDiagram_pkey" PRIMARY KEY ("id")
);

-- SeoArticleTable テーブルを作成
CREATE TABLE IF NOT EXISTS "SeoArticleTable" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "articleId"   TEXT NOT NULL,
    "marker"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoArticleTable_pkey" PRIMARY KEY ("id")
);

-- インデックス
CREATE UNIQUE INDEX IF NOT EXISTS "SeoArticleDiagram_articleId_marker_key" ON "SeoArticleDiagram"("articleId", "marker");
CREATE INDEX IF NOT EXISTS "SeoArticleDiagram_tenantId_idx" ON "SeoArticleDiagram"("tenantId");
CREATE INDEX IF NOT EXISTS "SeoArticleDiagram_articleId_idx" ON "SeoArticleDiagram"("articleId");

CREATE UNIQUE INDEX IF NOT EXISTS "SeoArticleTable_articleId_marker_key" ON "SeoArticleTable"("articleId", "marker");
CREATE INDEX IF NOT EXISTS "SeoArticleTable_tenantId_idx" ON "SeoArticleTable"("tenantId");
CREATE INDEX IF NOT EXISTS "SeoArticleTable_articleId_idx" ON "SeoArticleTable"("articleId");

-- 外部キー制約（既存の場合はスキップ）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SeoArticleDiagram_articleId_fkey'
  ) THEN
    ALTER TABLE "SeoArticleDiagram" ADD CONSTRAINT "SeoArticleDiagram_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "SeoArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SeoArticleDiagram_tenantId_fkey'
  ) THEN
    ALTER TABLE "SeoArticleDiagram" ADD CONSTRAINT "SeoArticleDiagram_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SeoArticleTable_articleId_fkey'
  ) THEN
    ALTER TABLE "SeoArticleTable" ADD CONSTRAINT "SeoArticleTable_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "SeoArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SeoArticleTable_tenantId_fkey'
  ) THEN
    ALTER TABLE "SeoArticleTable" ADD CONSTRAINT "SeoArticleTable_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
