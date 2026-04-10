ALTER TABLE "User" ADD COLUMN "alpacaPreferredEnvironment" TEXT DEFAULT 'paper';
ALTER TABLE "User" ADD COLUMN "alpacaLiveAccessTokenEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "alpacaLiveScope" TEXT;
ALTER TABLE "User" ADD COLUMN "alpacaLiveConnectedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "alpacaPaperAccessTokenEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "alpacaPaperScope" TEXT;
ALTER TABLE "User" ADD COLUMN "alpacaPaperConnectedAt" DATETIME;
