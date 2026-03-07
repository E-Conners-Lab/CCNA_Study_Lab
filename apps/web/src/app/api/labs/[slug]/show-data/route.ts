import { NextRequest } from "next/server";
import { getLabShowData } from "@/lib/data";
import { jsonOk, jsonNotFound, jsonError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const data = getLabShowData(slug);

    if (!data) {
      return jsonNotFound(`Lab "${slug}"`);
    }

    return jsonOk(data);
  } catch (error) {
    console.error("Error loading lab show data:", error);
    return jsonError("Failed to load lab show data");
  }
}
