import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

/**
 * Helper untuk mengekstrak Base64 murni dan MimeType dari Data URL webcam
 */
function extractBase64Data(imageInput: string): { mimeType: string; data: string } {
  const match = imageInput.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,([\s\S]+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2].replace(/\s/g, ""),
    };
  }

  // Jika input berupa raw base64 tanpa prefix data URI
  return {
    mimeType: "image/jpeg",
    data: imageInput.replace(/\s/g, ""),
  };
}

/**
 * Helper untuk membersihkan output AI dari markdown codeblock (```json ... ```)
 */
function parseJsonFromMarkdown(rawText: string): any {
  let cleaned = rawText.trim();

  // Bersihkan block markdown ```json ... ``` atau ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match && match[1]) {
    cleaned = match[1].trim();
  } else {
    // Fallback: temukan kurung kurawal pertama dan terakhir jika ada teks pengantar
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { image } = body;

    if (!image || typeof image !== "string") {
      return Response.json(
        { error: "Payload gambar (Base64 dari kamera webcam) wajib disertakan." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY belum dikonfigurasi di file .env server. Silakan tambahkan GEMINI_API_KEY pada variabel lingkungan Anda.",
        },
        { status: 500 }
      );
    }

    const { mimeType, data: base64Data } = extractBase64Data(image);
    if (!base64Data) {
      return Response.json(
        { error: "Data gambar Base64 kosong atau tidak valid." },
        { status: 400 }
      );
    }

    // Inisialisasi GoogleGenerativeAI menggunakan SDK resmi
    const genAI = new GoogleGenerativeAI(apiKey);

    // System prompt holistik yang ketat sesuai spesifikasi bisnis POS
    const systemPrompt =
      "Anda adalah asisten praktisi holistik. Analisa gambar wajah ini dan kategorikan kondisi energinya ke dalam SATU dari empat tag berikut: 'tegang', 'cemas', 'lelah', atau 'optimal'. Jangan gunakan kata negatif (marah/sedih). Kembalikan respons murni dalam format JSON: { \"mood_tag\": \"nama_tag\", \"diagnosis_text\": \"Kondisi Energi: [Nama Kondisi]. [Satu kalimat penjelasan berempati tentang otot wajah atau energi mereka]\" }";

    // 1. Mekanisme Fallback Array (dari opsi dynamic env hingga stable gemini-1.5-flash)
    const MODEL_CANDIDATES = [
      process.env.GEMINI_MODEL, // Opsi 1: Bisa diisi di Vercel Env (misal: gemini-2.0-flash)
      "gemini-3.0-flash",       // Opsi 2: Future proofing
      "gemini-2.5-flash",       // Opsi 3: Future proofing
      "gemini-2.0-flash",       // Opsi 4: Future proofing
      "gemini-1.5-flash",       // Opsi 5: Current Stable
    ].filter(Boolean) as string[]; // Hapus nilai undefined/null

    let resultText = "";
    let lastError: any = null;

    // 2 & 3. Iterasi (looping) kandidat model dengan try...catch untuk mengantisipasi 404 / deprecated model
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        // 4. Siapkan payload gambar sesuai standar multimodal Gemini terbaru (inlineData murni)
        const imagePart = {
          inlineData: {
            data: base64Data, // Prefix 'data:image/...;base64,' sudah dibuang
            mimeType: mimeType || "image/jpeg",
          },
        };

        const result = await model.generateContent([systemPrompt, imagePart]);
        resultText = result.response.text();

        // Jika berhasil, log dan hentikan loop pencarian model
        console.log(`Berhasil menggunakan model: ${modelName}`);
        break;
      } catch (error: any) {
        console.warn(`Model ${modelName} tidak tersedia/deprecated. Mencoba fallback...`);
        lastError = error;
      }
    }

    if (!resultText) {
      throw new Error(`Semua kandidat model gagal: ${lastError?.message}`);
    }

    // Parse respons JSON dengan pembersihan markdown
    const parsed = parseJsonFromMarkdown(resultText);

    // Normalisasi mood_tag ke 4 kategori baku: 'tegang', 'cemas', 'lelah', 'optimal'
    const rawTag = String(parsed?.mood_tag || "").toLowerCase().trim();
    let validatedMood: "tegang" | "cemas" | "lelah" | "optimal" = "optimal";

    if (rawTag.includes("tegang")) {
      validatedMood = "tegang";
    } else if (rawTag.includes("cemas")) {
      validatedMood = "cemas";
    } else if (rawTag.includes("lelah")) {
      validatedMood = "lelah";
    } else {
      validatedMood = "optimal";
    }

    // Format diagnosis_text dengan fallback jika kosong
    let diagnosisText = parsed?.diagnosis_text?.trim();
    if (!diagnosisText) {
      const conditionName = validatedMood.charAt(0).toUpperCase() + validatedMood.slice(1);
      diagnosisText = `Kondisi Energi: ${conditionName}. Garis ekspresi wajah Anda merefleksikan kebutuhan keseimbangan dan hidrasi alami.`;
    }

    return Response.json({
      mood_tag: validatedMood,
      diagnosis_text: diagnosisText,
    });
  } catch (error: any) {
    console.error("Error analyzing mood in /api/analyze-mood:", error);
    return Response.json(
      {
        error:
          error?.message ||
          "Terjadi kendala saat memproses analisa ekspresi wajah dengan Gemini AI.",
      },
      { status: 500 }
    );
  }
}
