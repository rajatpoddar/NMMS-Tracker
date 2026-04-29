import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/scrape?date=YYYY-MM-DD
// Starts a scrape job. Returns immediately with scrapeLogId for polling.
// Guards against duplicate scrapes for the same date.
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const scraperUrl = process.env.SCRAPER_URL || "http://scraper:5000";

  // Guard: block if already running or already succeeded
  const existing = await prisma.scrapeLog.findFirst({
    where: { scrapeDate: date },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.status === "running") {
    return NextResponse.json(
      { success: false, error: "already_running", scrapeLogId: existing.id },
      { status: 409 }
    );
  }
  if (existing?.status === "success") {
    return NextResponse.json(
      { success: false, error: "already_done", scrapeLogId: existing.id },
      { status: 409 }
    );
  }

  // Create a "running" log entry
  const scrapeLog = await prisma.scrapeLog.create({
    data: {
      scrapeDate: date,
      status: "running",
      startedAt: new Date(),
    },
  });

  // Fire off scraper in background — don't await
  triggerScraper(scraperUrl, date, scrapeLog.id).catch(console.error);

  return NextResponse.json({
    success: true,
    message: "Scrape started",
    scrapeLogId: scrapeLog.id,
    date,
  });
}

async function triggerScraper(scraperUrl: string, date: string, scrapeLogId: number) {
  const triggerEndpoint = `${scraperUrl}/trigger?date=${encodeURIComponent(date)}&scrapeLogId=${scrapeLogId}`;

  try {
    const response = await fetch(triggerEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(660_000), // 11 min
    });

    const data = await response.json();

    // Parse final counts from scraper output
    const output: string = data.output || "";
    const totalMatch = output.match(/Processing (\d+) MRs/);
    const doneMatch = output.match(/Done\. Processed: (\d+), Failed: (\d+)/);

    const totalMRs = totalMatch ? parseInt(totalMatch[1]) : 0;
    const processedMRs = doneMatch ? parseInt(doneMatch[1]) : 0;
    const failedMRs = doneMatch ? parseInt(doneMatch[2]) : 0;

    const status = response.ok && data.success
      ? failedMRs > 0 ? "partial" : "success"
      : "failed";

    await prisma.scrapeLog.update({
      where: { id: scrapeLogId },
      data: {
        status,
        totalMRs,
        processedMRs,
        failedMRs,
        completedAt: new Date(),
        message: data.errors || null,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    await prisma.scrapeLog.update({
      where: { id: scrapeLogId },
      data: {
        status: "failed",
        completedAt: new Date(),
        message: err.message || "Unknown error",
      },
    });
  }
}
