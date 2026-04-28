import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: list MRs for a date + optional panchayat filter
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const panchayatCode = searchParams.get("panchayatCode");

  const where: Record<string, unknown> = { attendanceDate: date };
  if (panchayatCode) where.panchayatCode = panchayatCode;

  try {
    const musterRolls = await prisma.musterRoll.findMany({
      where,
      orderBy: [{ panchayatName: "asc" }, { msrNo: "asc" }],
      select: {
        id: true,
        attendanceDate: true,
        districtName: true,
        blockName: true,
        panchayatCode: true,
        panchayatName: true,
        workCode: true,
        msrNo: true,
        workName: true,
        totalWorkers: true,
        presentCount: true,
        absentCount: true,
        photo1Url: true,
        photo2Url: true,
      },
    });
    return NextResponse.json({ musterRolls });
  } catch (error) {
    console.error("MR list API error:", error);
    return NextResponse.json({ error: "Failed to fetch muster rolls" }, { status: 500 });
  }
}

// POST: upsert MR data from scraper
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { musterRolls } = body as { musterRolls: MusterRollInput[] };

    if (!Array.isArray(musterRolls) || musterRolls.length === 0) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    let upserted = 0;
    for (const mr of musterRolls) {
      const existing = await prisma.musterRoll.upsert({
        where: {
          attendanceDate_workCode_msrNo: {
            attendanceDate: mr.attendanceDate,
            workCode: mr.workCode,
            msrNo: mr.msrNo,
          },
        },
        update: {
          workName: mr.workName,
          photo1Url: mr.photo1Url,
          photo1TakenAt: mr.photo1TakenAt,
          photo1UploadedAt: mr.photo1UploadedAt,
          photo1Coords: mr.photo1Coords,
          photo1TakenBy: mr.photo1TakenBy,
          photo1Designation: mr.photo1Designation,
          photo2Url: mr.photo2Url,
          photo2TakenAt: mr.photo2TakenAt,
          photo2UploadedAt: mr.photo2UploadedAt,
          photo2Coords: mr.photo2Coords,
          totalWorkers: mr.workers?.length ?? 0,
          presentCount: mr.workers?.filter((w) => w.isPresent).length ?? 0,
          absentCount: mr.workers?.filter((w) => !w.isPresent).length ?? 0,
        },
        create: {
          attendanceDate: mr.attendanceDate,
          districtCode: mr.districtCode,
          districtName: mr.districtName,
          blockCode: mr.blockCode,
          blockName: mr.blockName,
          panchayatCode: mr.panchayatCode,
          panchayatName: mr.panchayatName,
          workCode: mr.workCode,
          msrNo: mr.msrNo,
          workName: mr.workName,
          detailUrl: mr.detailUrl,
          photo1Url: mr.photo1Url,
          photo1TakenAt: mr.photo1TakenAt,
          photo1UploadedAt: mr.photo1UploadedAt,
          photo1Coords: mr.photo1Coords,
          photo1TakenBy: mr.photo1TakenBy,
          photo1Designation: mr.photo1Designation,
          photo2Url: mr.photo2Url,
          photo2TakenAt: mr.photo2TakenAt,
          photo2UploadedAt: mr.photo2UploadedAt,
          photo2Coords: mr.photo2Coords,
          totalWorkers: mr.workers?.length ?? 0,
          presentCount: mr.workers?.filter((w) => w.isPresent).length ?? 0,
          absentCount: mr.workers?.filter((w) => !w.isPresent).length ?? 0,
        },
      });

      // Upsert workers
      if (mr.workers && mr.workers.length > 0) {
        // Delete old workers for this MR and re-insert
        await prisma.worker.deleteMany({ where: { musterRollId: existing.id } });
        await prisma.worker.createMany({
          data: mr.workers.map((w) => ({
            musterRollId: existing.id,
            sno: w.sno,
            jobCardNo: w.jobCardNo,
            workerName: w.workerName,
            gender: w.gender,
            attendanceDate: mr.attendanceDate,
            isPresent: w.isPresent,
          })),
        });
      }
      upserted++;
    }

    return NextResponse.json({ success: true, upserted });
  } catch (error) {
    console.error("MR POST error:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}

interface WorkerInput {
  sno: number;
  jobCardNo: string;
  workerName: string;
  gender?: string;
  isPresent: boolean;
}

interface MusterRollInput {
  attendanceDate: string;
  districtCode: string;
  districtName: string;
  blockCode: string;
  blockName: string;
  panchayatCode: string;
  panchayatName: string;
  workCode: string;
  msrNo: string;
  workName?: string;
  detailUrl: string;
  photo1Url?: string;
  photo1TakenAt?: string;
  photo1UploadedAt?: string;
  photo1Coords?: string;
  photo1TakenBy?: string;
  photo1Designation?: string;
  photo2Url?: string;
  photo2TakenAt?: string;
  photo2UploadedAt?: string;
  photo2Coords?: string;
  workers?: WorkerInput[];
}
