-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "diagramPreference" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "diagramInstructions" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "imageStyleInstructions" TEXT;
