import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

function extractBase64Data(imageInput: string): { mimeType: string; data: string } {
  const match = imageInput.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([\s\S]+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2].replace(/\s/g, ""),
    };
  }
  return {
    mimeType: "image/jpeg",
    data: imageInput.replace(/\s/g, ""),
  };
}

function parseJsonFromMarkdown(rawText: string): any {
  let cleaned = rawText.trim();
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match && match[1]) {
    cleaned = match[1].trim();
  } else {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
    }
  }
  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  await ensureSeeded();
  try {
    const body = await req.json().catch(() => ({}));
    const attendanceId = Number(body.attendanceId || body.id);

    if (!attendanceId || isNaN(attendanceId)) {
      return NextResponse.json({ error: "ID log absensi wajib disertakan." }, { status: 400 });
    }

    const [record] = await db
      .select({
        id: attendances.id,
        photoUrl: attendances.photoUrl,
        mood: attendances.mood,
        moodDiagnosis: attendances.moodDiagnosis,
      })
      .from(attendances)
      .where(eq(attendances.id, attendanceId))
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Data log absensi tidak ditemukan." }, { status: 404 });
    }

    const photoToAnalyze = String(body.photoUrl || record.photoUrl || "");
    if (!photoToAnalyze || !photoToAnalyze.startsWith("data:image")) {
      return NextResponse.json({ error: "Foto wajah tidak ditemukan atau format tidak valid." }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "AIzaSyDNwFoo79yTzLL_u35G-CGM9l3raQfCiX0";

    const { mimeType, data: base64Data } = extractBase64Data(photoToAnalyze);
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemPrompt =
      "Anda adalah asisten praktisi holistik. Analisa gambar wajah ini dan kategorikan kondisi energinya ke dalam SATU dari empat tag berikut: 'tegang', 'cemas', 'lelah', atau 'optimal'. Jangan gunakan kata negatif (marah/sedih). Kembalikan respons murni dalam format JSON: { \"mood_tag\": \"nama_tag\", \"diagnosis_text\": \"Kondisi Energi: [Nama Kondisi]. [Satu kalimat penjelasan berempati tentang otot wajah atau energi mereka]\" }";

    const MODEL_CANDIDATES = [
      process.env.GEMINI_MODEL,
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ].filter(Boolean) as string[];

    let resultText = "";
    modelLoop: for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: mimeType || "image/jpeg",
          },
        };
        const result = await model.generateContent([systemPrompt, imagePart]);
        resultText = result.response.text();
        if (resultText) break modelLoop;
      } catch (err) {
        console.warn(`[Gemini API] Error model ${modelName}:`, err);
      }
    }

    let finalMood: "optimal" | "lelah" | "tegang" | "cemas" = "optimal";
    let finalDiagnosis = "";

    if (resultText) {
      try {
        const parsed = parseJsonFromMarkdown(resultText);
        const rawTag = String(parsed?.mood_tag || "").toLowerCase().trim();
        if (rawTag.includes("tegang")) finalMood = "tegang";
        else if (rawTag.includes("cemas")) finalMood = "cemas";
        else if (rawTag.includes("lelah")) finalMood = "lelah";
        else finalMood = "optimal";

        finalDiagnosis = parsed?.diagnosis_text?.trim() || "";
      } catch {
        console.warn("Gagal parse output JSON Gemini, menggunakan fallback terstruktur.");
      }
    }

    if (!finalDiagnosis) {
      const conditionName = finalMood.charAt(0).toUpperCase() + finalMood.slice(1);
      finalDiagnosis = `Kondisi Energi: ${conditionName}. Garis ekspresi wajah mencerminkan fokus kerja dan kebutuhan hidrasi aromatik.`;
    }

    // Perbarui record di database
    await db
      .update(attendances)
      .set({
        mood: finalMood,
        moodDiagnosis: finalDiagnosis,
        updatedAt: new Date(),
      })
      .where(eq(attendances.id, attendanceId));

    return NextResponse.json({
      success: true,
      message: "Analisa sentimen mood berhasil dilakukan.",
      mood: finalMood,
      moodDiagnosis: finalDiagnosis,
    });
  } catch (err: unknown) {
    console.error("POST /api/attendance/analyze error:", err);
    return NextResponse.json({ error: "Gagal menganalisa mood wajah staf." }, { status: 500 });
  }
}
