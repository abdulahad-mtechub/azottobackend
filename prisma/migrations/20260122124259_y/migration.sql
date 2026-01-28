-- CreateEnum
CREATE TYPE "ColorStatus" AS ENUM ('GREEN', 'YELLOW', 'LIGHT_ORANGE', 'DARK_ORANGE', 'RED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "conditionMatrixId" TEXT,
ADD COLUMN     "mechanicalHealthId" TEXT;

-- AlterTable
ALTER TABLE "ConditionMatrix" ADD COLUMN     "updatedAt" TIMESTAMP(3),
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "vinPassportId" TEXT;

-- CreateTable
CREATE TABLE "MechanicalHealth" (
    "id" TEXT NOT NULL,
    "vinPassportId" TEXT NOT NULL,
    "partsMaintained" JSONB,
    "lastUpdate" TIMESTAMP(3),
    "greenLight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MechanicalHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MechanicalHealth_vinPassportId_key" ON "MechanicalHealth"("vinPassportId");

-- AddForeignKey
ALTER TABLE "ConditionMatrix" ADD CONSTRAINT "ConditionMatrix_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicalHealth" ADD CONSTRAINT "MechanicalHealth_vinPassportId_fkey" FOREIGN KEY ("vinPassportId") REFERENCES "VinPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_conditionMatrixId_fkey" FOREIGN KEY ("conditionMatrixId") REFERENCES "ConditionMatrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_mechanicalHealthId_fkey" FOREIGN KEY ("mechanicalHealthId") REFERENCES "MechanicalHealth"("id") ON DELETE SET NULL ON UPDATE CASCADE;
