-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "cronInterval" TEXT NOT NULL DEFAULT '1h',
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "nextRunAt" TIMESTAMP(3);
