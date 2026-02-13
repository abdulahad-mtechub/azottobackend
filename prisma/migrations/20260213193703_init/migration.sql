-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OWNER', 'DEALER', 'FLEET_MANAGER', 'MANUFACTURER', 'ADMIN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VinStatus" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'TRANSFER_PENDING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SERVICE_INVOICE', 'TITLE', 'REGISTRATION', 'OWNERSHIP_PROOF', 'INSURANCE_CERTIFICATE', 'MAINTENANCE_HISTORY', 'SUPPORTING_DOCUMENT', 'FRONT_VIEW', 'BACK_VIEW', 'SIDE_VIEWS', 'INTERIOR_VIEW', 'ENGINE_ODOMETER', 'ADDITIONAL_IMAGES');

-- CreateEnum
CREATE TYPE "CollisionFlag" AS ENUM ('GREEN', 'YELLOW', 'LIGHT_ORANGE', 'DARK_ORANGE', 'RED');

-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('DEALER', 'MANUFACTURER', 'PRIVATE');

-- CreateEnum
CREATE TYPE "FinancialCategory" AS ENUM ('REVENUE', 'TRUTH_INCENTIVE', 'FEE', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('DEALER', 'FLEET', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('SENT', 'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'LOGIN', 'LOGOUT', 'EDIT', 'REQUEST', 'CHANGE_STATUS', 'CONTACTED', 'RENEW', 'MAINTENANCE_MODE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('USER', 'WALLET', 'VIN_PASSPORT', 'DOCUMENT', 'BlockchainTransaction');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "role" "UserRole",
    "anonRefId" TEXT,
    "emailEncrypted" TEXT,
    "coinbaseUserId" TEXT,
    "walletAddress" TEXT,
    "signature" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycDebtActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "availableAZTO" INTEGER NOT NULL,
    "lockedAZTO" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinPassport" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "status" "VinStatus" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mintedTokenId" TEXT,
    "titleRegHash" TEXT,
    "milestoneCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VinPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "s3Url" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "fileFingerprint" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "shopName" TEXT,
    "businessAddress" TEXT,
    "googleMapsStatus" BOOLEAN,
    "odometer" INTEGER,
    "batteryVoltage" DOUBLE PRECISION,
    "coolantLevelType" TEXT,
    "syntheticOilDetection" BOOLEAN,
    "transmissionFluidStatus" TEXT,
    "tireTreadDepth" DOUBLE PRECISION,
    "collisionDetection" BOOLEAN,
    "replacementPartCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MileageRecord" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "sourceDocId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "flaggedTMU" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MileageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionState" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "collisionStatus" "CollisionFlag" NOT NULL,
    "mechanicalGreen" BOOLEAN NOT NULL,
    "tableA_DamageCount" INTEGER NOT NULL DEFAULT 0,
    "tableB_MaintenanceCount" INTEGER NOT NULL DEFAULT 0,
    "tmuFlag" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedOdometer" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vinPassportId" TEXT,
    "txId" TEXT NOT NULL,
    "aztoAmount" INTEGER NOT NULL,
    "capacityLockStatus" BOOLEAN NOT NULL DEFAULT false,
    "gasUnit" INTEGER NOT NULL DEFAULT 3,
    "fmvUSD" DECIMAL(18,6),
    "costBasis" DECIMAL(18,6),
    "proceeds" DECIMAL(18,6),
    "financialCategory" "FinancialCategory" NOT NULL,
    "splitRatio" DECIMAL(5,2),
    "aerodromeLockStatus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "settledCredits" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePurchase" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerType" "BuyerType" NOT NULL,
    "revenueSplit" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipTransfer" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "toEmail" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "deepLinkToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinBatch" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'QUEUED',
    "qualifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "VinBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemControl" (
    "id" TEXT NOT NULL,
    "mintingPaused" BOOLEAN NOT NULL DEFAULT false,
    "marketplacePaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userRole" "UserRole" NOT NULL,
    "action" "AlertAction" NOT NULL,
    "activity" TEXT NOT NULL,
    "businessId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_anonRefId_key" ON "User"("anonRefId");

-- CreateIndex
CREATE UNIQUE INDEX "User_coinbaseUserId_key" ON "User"("coinbaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "VinPassport_vin_key" ON "VinPassport"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "Document_hash_key" ON "Document"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileFingerprint_key" ON "Document"("fileFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionState_vinPassportId_key" ON "ConditionState"("vinPassportId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedger_txId_key" ON "FinancialLedger"("txId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceListing_productId_key" ON "MarketplaceListing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipTransfer_deepLinkToken_key" ON "OwnershipTransfer"("deepLinkToken");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinPassport" ADD CONSTRAINT "VinPassport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageRecord" ADD CONSTRAINT "MileageRecord_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageRecord" ADD CONSTRAINT "MileageRecord_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionState" ADD CONSTRAINT "ConditionState_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedger" ADD CONSTRAINT "FinancialLedger_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinBatch" ADD CONSTRAINT "VinBatch_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
