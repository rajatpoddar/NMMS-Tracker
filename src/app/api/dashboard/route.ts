import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    // KPI aggregates
    const [totalMRs, panchayatAgg, workerAgg] = await Promise.all([
      prisma.musterRoll.count({ where: { attendanceDate: date } }),
      prisma.musterRoll.groupBy({
        by: ["panchayatCode"],
        where: { attendanceDate: date },
        _count: { id: true },
      }),
      prisma.musterRoll.aggregate({
        where: { attendanceDate: date },
        _sum: { presentCount: true, absentCount: true, totalWorkers: true },
      }),
    ]);

    // Panchayat-level summary
    const panchayatSummary = await prisma.musterRoll.groupBy({
      by: ["panchayatCode", "panchayatName", "districtName", "blockName"],
      where: { attendanceDate: date },
      _count: { id: true },
      _sum: { presentCount: true, absentCount: true, totalWorkers: true },
      orderBy: { panchayatName: "asc" },
    });

    return NextResponse.json({
      date,
      kpi: {
        totalPanchayats: panchayatAgg.length,
        totalMRs,
        totalPresent: workerAgg._sum.presentCount ?? 0,
        totalAbsent: workerAgg._sum.absentCount ?? 0,
        totalWorkers: workerAgg._sum.totalWorkers ?? 0,
      },
      panchayats: panchayatSummary.map((p) => ({
        panchayatCode: p.panchayatCode,
        panchayatName: p.panchayatName,
        districtName: p.districtName,
        blockName: p.blockName,
        mrCount: p._count.id,
        presentCount: p._sum.presentCount ?? 0,
        absentCount: p._sum.absentCount ?? 0,
        totalWorkers: p._sum.totalWorkers ?? 0,
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
