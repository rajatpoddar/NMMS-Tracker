import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

// Serves locally downloaded MGNREGA photos from PHOTOS_DIR
// PHOTOS_DIR is set via env — in Docker it's /app/data/photos (shared volume)
// In dev it falls back to ./public/photos

const PHOTOS_DIR =
  process.env.PHOTOS_DIR ||
  path.join(process.cwd(), "public", "photos");

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Sanitize filename — only allow safe characters, no path traversal
  const filename = params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!filename || filename !== params.filename) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const filePath = path.join(PHOTOS_DIR, filename);

  // Ensure the resolved path is still inside PHOTOS_DIR
  if (!filePath.startsWith(path.resolve(PHOTOS_DIR))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!existsSync(filePath)) {
    return new NextResponse("Photo not found", { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable", // photos never change
      },
    });
  } catch {
    return new NextResponse("Failed to read photo", { status: 500 });
  }
}
