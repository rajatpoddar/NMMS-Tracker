import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/scrape/progress
// Called by scraper container to update live progress
// Body: { scrapeLogId, processedMRs, totalMRs, failedMRs }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { scrapeLogId, processedMRs, totalMRs, failedMRs } = body as {
      scrapeLogId: number;
      processedMRs: number;
      totalMRs: number;
      failedMRs?: number;
    };

    if (!scrapeLogId) {
      return NextResponse.json({ error: "scrapeLogId required" }, { status: 400 });
    }

    await prisma.scrapeLog.update({
      where: { id: scrapeLogId },
      data: {
        processedMRs: processedMRs ?? 0,
        totalMRs: totalMRs ?? 0,
        failedMRs: failedMRs ?? 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progress update error:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
