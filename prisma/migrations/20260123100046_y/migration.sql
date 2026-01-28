/*
  Warnings:

  - Added the required column `status` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "TxStatus" ADD VALUE 'VERIFIED';

-- AlterTable
ALTER TABLE "BlockchainTransaction" ALTER COLUMN "blockNumber" DROP NOT NULL,
ALTER COLUMN "eventName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "status" "TxStatus" NOT NULL;
