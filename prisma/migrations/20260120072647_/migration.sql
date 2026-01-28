/*
  Warnings:

  - You are about to alter the column `balance` on the `AztoWallet` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,8)`.
  - You are about to alter the column `amount` on the `GasSettlement` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,8)`.
  - You are about to alter the column `price` on the `NormalizedPart` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(18,2)`.
  - A unique constraint covering the columns `[number]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `entityType` on the `AIDecision` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `action` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `entityType` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'WALLET', 'VIN_PASSPORT', 'INVOICE', 'PART', 'GAS_SETTLEMENT');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- DropForeignKey
ALTER TABLE "NormalizedPart" DROP CONSTRAINT "NormalizedPart_invoiceId_fkey";

-- DropIndex
DROP INDEX "User_signature_key";

-- AlterTable
ALTER TABLE "AIDecision" ADD COLUMN     "userId" TEXT,
DROP COLUMN "entityType",
ADD COLUMN     "entityType" "EntityType" NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "chainTxId" TEXT,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL,
DROP COLUMN "entityType",
ADD COLUMN     "entityType" "EntityType" NOT NULL;

-- AlterTable
ALTER TABLE "AztoWallet" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(18,8);

-- AlterTable
ALTER TABLE "GasSettlement" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,8);

-- AlterTable
ALTER TABLE "NormalizedPart" ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,2);

-- CreateTable
CREATE TABLE "BlockchainTransaction" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "eventName" TEXT NOT NULL,
    "status" "TxStatus" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnChainProof" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "invoiceId" TEXT,
    "vinPassportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnChainProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainCursor" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainTransaction_txHash_key" ON "BlockchainTransaction"("txHash");

-- CreateIndex
CREATE INDEX "BlockchainTransaction_entityType_entityId_idx" ON "BlockchainTransaction"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "GasSettlement_vinPassportId_idx" ON "GasSettlement"("vinPassportId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_vinPassportId_idx" ON "Invoice"("vinPassportId");

-- CreateIndex
CREATE INDEX "Invoice_isDeleted_idx" ON "Invoice"("isDeleted");

-- CreateIndex
CREATE INDEX "NormalizedPart_invoiceId_idx" ON "NormalizedPart"("invoiceId");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_isDeleted_idx" ON "User"("isDeleted");

-- CreateIndex
CREATE INDEX "VinPassport_vin_idx" ON "VinPassport"("vin");

-- CreateIndex
CREATE INDEX "VinPassport_isDeleted_idx" ON "VinPassport"("isDeleted");

-- AddForeignKey
ALTER TABLE "NormalizedPart" ADD CONSTRAINT "NormalizedPart_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_chainTxId_fkey" FOREIGN KEY ("chainTxId") REFERENCES "BlockchainTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIDecision" ADD CONSTRAINT "AIDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainTransaction" ADD CONSTRAINT "BlockchainTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnChainProof" ADD CONSTRAINT "OnChainProof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnChainProof" ADD CONSTRAINT "OnChainProof_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
