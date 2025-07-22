/*
  Warnings:

  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - Added the required column `company` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `department` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `surname` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'learner');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('marketing', 'it', 'learning');

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "username",
ADD COLUMN     "company" TEXT NOT NULL,
ADD COLUMN     "department" "Department" NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "number" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL,
ADD COLUMN     "surname" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
