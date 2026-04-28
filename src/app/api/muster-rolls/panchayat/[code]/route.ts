import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const { code } = params;

  try {
    const musterRolls = await prisma.musterRoll.findMany({
      where: {
        panchayatCode: code,
        attendanceDate: date,
      },
      orderBy: { msrNo: "asc" },
      include: {
        workers: {
          orderBy: { sno: "asc" },
        },
      },
    });

    if (musterRolls.length === 0) {
      return NextResponse.json({ musterRolls: [], panchayatName: "", date });
    }

    return NextResponse.json({
      musterRolls,
      panchayatName: musterRolls[0].panchayatName,
      blockName: musterRolls[0].blockName,
      districtName: musterRolls[0].districtName,
      date,
    });
  } catch (error) {
    console.error("Panchayat MR API error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
