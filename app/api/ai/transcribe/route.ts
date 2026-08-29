/**
 * app/api/ai/transcribe/route.ts — PQE AI Assistant
 *
 * Secure server-side route for audio transcription using OpenAI Whisper.
 *
 * Security controls:
 * - OPENAI_API_KEY is server-side only — never sent to browser.
 * - Accepts multipart/form-data with an audio file.
 * - Audio file size capped at 20 MB (Whisper API limit).
 * - Audio is forwarded to Whisper and the result returned — not persisted server-side.
 * - Rate limiting should be added before production deployment.
 */

import { NextRequest, NextResponse } from "next/server";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB — Whisper limit

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. Add it to .env.local to enable transcription." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio file too large (max 20 MB)" }, { status: 400 });
  }

  // Forward to Whisper
  try {
    const whisperForm = new FormData();
    whisperForm.append("file", file, "recording.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");
    whisperForm.append(
      "prompt",
      "Procurement quality engineering audit. Technical manufacturing discussion. " +
      "Terms include: PFMEA, Control Plan, Cpk, GD&T, CMM, calibration, non-conformance."
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Whisper API error:", response.status, err.slice(0, 200));
      return NextResponse.json(
        { error: "Transcription service unavailable. Please try again." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { text: string };
    return NextResponse.json({ transcript: data.text ?? "" });
  } catch (e) {
    console.error("Whisper fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Failed to reach transcription service. Check your internet connection." },
      { status: 502 }
    );
  }
}
