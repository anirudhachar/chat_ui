import { NextResponse } from "next/server";
import ogs from "open-graph-scraper";

export const runtime = "nodejs"; 

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const { result } = await ogs({ url });

    return NextResponse.json({
      success: true,
      title: result.ogTitle || result.twitterTitle || "",
      description: result.ogDescription || result.twitterDescription || "",
      image: result.ogImage?.[0]?.url || result.twitterImage || "",
      url,
    });
  } catch (error) {
    console.error("Preview fetch failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch preview" },
      { status: 500 }
    );
  }
}
