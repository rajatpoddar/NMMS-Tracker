import { NextRequest, NextResponse } from "next/server";

// This endpoint triggers the Python scraper via a shell command
// In production (Docker), the scraper runs as a cron job directly.
// This endpoint is useful for manual triggers from the UI.
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // In Docker, the scraper is run via cron. For manual trigger, we call it here.
  // The scraper writes directly to the DB via the POST /api/muster-rolls endpoint.
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const scraperPath = process.env.SCRAPER_PATH || "/app/scraper/scraper.py";
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    const { stdout, stderr } = await execAsync(
      `python3 "${scraperPath}" --date "${date}" --api-url "${apiBase}"`,
      { timeout: 300000 } // 5 min timeout
    );

    return NextResponse.json({
      success: true,
      message: "Scraper completed",
      output: stdout,
      errors: stderr || null,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string };
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Scraper failed",
        details: err.stderr || null,
      },
      { status: 500 }
    );
  }
}
