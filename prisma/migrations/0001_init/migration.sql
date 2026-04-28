-- CreateTable
CREATE TABLE "ScrapeLog" (
    "id" SERIAL NOT NULL,
    "scrapeDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalMRs" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusterRoll" (
    "id" SERIAL NOT NULL,
    "attendanceDate" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL DEFAULT '34',
    "stateName" TEXT NOT NULL DEFAULT 'JHARKHAND',
    "districtCode" TEXT NOT NULL,
    "districtName" TEXT NOT NULL,
    "blockCode" TEXT NOT NULL,
    "blockName" TEXT NOT NULL,
    "panchayatCode" TEXT NOT NULL,
    "panchayatName" TEXT NOT NULL,
    "workCode" TEXT NOT NULL,
    "msrNo" TEXT NOT NULL,
    "workName" TEXT,
    "detailUrl" TEXT NOT NULL,
    "photo1Url" TEXT,
    "photo1TakenAt" TEXT,
    "photo1UploadedAt" TEXT,
    "photo1Coords" TEXT,
    "photo1TakenBy" TEXT,
    "photo1Designation" TEXT,
    "photo2Url" TEXT,
    "photo2TakenAt" TEXT,
    "photo2UploadedAt" TEXT,
    "photo2Coords" TEXT,
    "totalWorkers" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusterRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" SERIAL NOT NULL,
    "musterRollId" INTEGER NOT NULL,
    "sno" INTEGER NOT NULL,
    "jobCardNo" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "gender" TEXT,
    "attendanceDate" TEXT NOT NULL,
    "isPresent" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MusterRoll_attendanceDate_idx" ON "MusterRoll"("attendanceDate");

-- CreateIndex
CREATE INDEX "MusterRoll_panchayatCode_idx" ON "MusterRoll"("panchayatCode");

-- CreateIndex
CREATE INDEX "MusterRoll_attendanceDate_panchayatCode_idx" ON "MusterRoll"("attendanceDate", "panchayatCode");

-- CreateIndex
CREATE UNIQUE INDEX "MusterRoll_attendanceDate_workCode_msrNo_key" ON "MusterRoll"("attendanceDate", "workCode", "msrNo");

-- CreateIndex
CREATE INDEX "Worker_musterRollId_idx" ON "Worker"("musterRollId");

-- CreateIndex
CREATE INDEX "Worker_attendanceDate_idx" ON "Worker"("attendanceDate");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_musterRollId_fkey" FOREIGN KEY ("musterRollId") REFERENCES "MusterRoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
