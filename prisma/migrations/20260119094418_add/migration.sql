-- CreateEnum
CREATE TYPE "AlertAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'LOGIN', 'LOGOUT', 'EDIT', 'REQUEST', 'CHANGE_STATUS', 'CONTACTED', 'RENEW', 'MAINTENANCE_MODE');

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
    "userId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);
