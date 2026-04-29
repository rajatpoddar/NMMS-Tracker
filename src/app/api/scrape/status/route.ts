import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/scrape/status?date=YYYY-MM-DD
// Returns current scrape status for a given date
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const log = await prisma.scrapeLog.findFirst({
      where: { scrapeDate: date },
      orderBy: { createdAt: "desc" },
    });

    if (!log) {
      return NextResponse.json({ status: "none", date });
    }

    // Estimate time remaining if running
    let estimatedSecondsRemaining: number | null = null;
    let elapsedSeconds: number | null = null;
    let percentComplete: number | null = null;

    if (log.status === "running" && log.startedAt) {
      elapsedSeconds = Math.floor((Date.now() - log.startedAt.getTime()) / 1000);

      if (log.totalMRs > 0 && log.processedMRs > 0) {
        const secsPerMR = elapsedSeconds / log.processedMRs;
        const remaining = log.totalMRs - log.processedMRs;
        estimatedSecondsRemaining = Math.ceil(secsPerMR * remaining);
        percentComplete = Math.round((log.processedMRs / log.totalMRs) * 100);
      } else if (log.totalMRs > 0) {
        // Not started processing yet — use 2s/MR estimate
        estimatedSecondsRemaining = log.totalMRs * 2;
        percentComplete = 0;
      }
    }

    if (log.status !== "running" && log.totalMRs > 0) {
      percentComplete = log.status === "success" || log.status === "partial"
        ? 100
        : null;
    }

    return NextResponse.json({
      status: log.status,
      date: log.scrapeDate,
      totalMRs: log.totalMRs,
      processedMRs: log.processedMRs,
      failedMRs: log.failedMRs,
      percentComplete,
      elapsedSeconds,
      estimatedSecondsRemaining,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      message: log.message,
    });
  } catch (error) {
    console.error("Scrape status error:", error);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
