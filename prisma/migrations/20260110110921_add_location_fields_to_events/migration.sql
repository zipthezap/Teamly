-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT;

-- CreateIndex
CREATE INDEX "Event_city_country_idx" ON "Event"("city", "country");
