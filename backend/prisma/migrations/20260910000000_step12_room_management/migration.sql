-- CreateTable Room
CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "floor" INTEGER DEFAULT 1,
    "roomType" TEXT DEFAULT 'Non-AC Room (2 Sharing)',
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable RoomAllocation
CREATE TABLE IF NOT EXISTS "RoomAllocation" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bedNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vacatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAllocation_pkey" PRIMARY KEY ("id")
);

-- Indexes for Room
CREATE UNIQUE INDEX IF NOT EXISTS "Room_blockId_roomNumber_key" ON "Room"("blockId", "roomNumber");
CREATE INDEX IF NOT EXISTS "Room_blockId_idx" ON "Room"("blockId");
CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room"("status");

-- Indexes for RoomAllocation
CREATE INDEX IF NOT EXISTS "RoomAllocation_roomId_idx" ON "RoomAllocation"("roomId");
CREATE INDEX IF NOT EXISTS "RoomAllocation_studentId_idx" ON "RoomAllocation"("studentId");
CREATE INDEX IF NOT EXISTS "RoomAllocation_status_idx" ON "RoomAllocation"("status");

-- Partial Unique Indexes for Single Active Allocation and Bed Reservation
CREATE UNIQUE INDEX IF NOT EXISTS "RoomAllocation_student_active_key"
ON "RoomAllocation"("studentId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "RoomAllocation_room_bed_active_key"
ON "RoomAllocation"("roomId", "bedNumber")
WHERE "status" = 'ACTIVE' AND "bedNumber" IS NOT NULL;

-- Foreign Keys
ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_blockId_fkey";
ALTER TABLE "Room" ADD CONSTRAINT "Room_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomAllocation" DROP CONSTRAINT IF EXISTS "RoomAllocation_roomId_fkey";
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomAllocation" DROP CONSTRAINT IF EXISTS "RoomAllocation_studentId_fkey";
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
