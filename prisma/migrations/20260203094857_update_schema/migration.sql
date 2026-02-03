-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;
