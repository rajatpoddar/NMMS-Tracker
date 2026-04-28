import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const mr = await prisma.musterRoll.findUnique({
      where: { id },
      include: {
        workers: { orderBy: { sno: "asc" } },
      },
    });

    if (!mr) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ musterRoll: mr });
  } catch (error) {
    console.error("MR detail API error:", error);
    return NextResponse.json({ error: "Failed to fetch detail" }, { status: 500 });
  }
}
