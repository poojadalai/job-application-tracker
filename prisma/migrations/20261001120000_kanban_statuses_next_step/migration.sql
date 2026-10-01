-- Wishlist is replaced by Screening; move any Wishlist rows to Applied first.
UPDATE "Application" SET "status" = 'Applied' WHERE "status" = 'Wishlist';

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('Applied', 'Screening', 'Interview', 'Offer', 'Rejected');
ALTER TABLE "public"."Application" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Application" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
ALTER TABLE "Application" ALTER COLUMN "status" SET DEFAULT 'Applied';
COMMIT;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "nextStep" TEXT NOT NULL DEFAULT '';

