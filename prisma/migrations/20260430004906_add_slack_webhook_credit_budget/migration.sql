-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "serankingCreditBudget" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "slackWebhookUrl" TEXT;
