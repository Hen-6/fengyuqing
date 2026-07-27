import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Forward to local Python ASR server
    const localFormData = new FormData();
    localFormData.append("file", file, "speech.wav");

    const localResponse = await fetch("http://localhost:8000/api/asr", {
      method: "POST",
      body: localFormData,
    });

    if (!localResponse.ok) {
      const errText = await localResponse.text();
      return NextResponse.json({ error: `Local ASR server error: ${errText}` }, { status: 500 });
    }

    const result = await localResponse.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[ASR Route] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
