import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Validasi apakah token memiliki struktur 3 bagian JWT (JWS: header.payload.signature)
 */
function isValidJwt(token?: string): boolean {
  if (!token) return false;
  const cleaned = token.trim().replace(/^["']|["']$/g, "");
  if (cleaned.length < 20) return false;
  const parts = cleaned.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

const cleanStr = (str?: string) => (str ? str.trim().replace(/^["']|["']$/g, "") : "");

/**
 * POST /api/upload
 * Endpoint aman untuk mengunggah gambar produk / aset storage.
 * Menangani token JWS yang tidak valid secara elegan agar preview deployment tidak crash.
 */
export async function POST(req: Request) {
  try {
    const supabaseUrl = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKey = cleanStr(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // 1. Validasi kecukupan konfigurasi environment variable & token JWS
    if (!supabaseUrl || !supabaseKey || !isValidJwt(supabaseKey)) {
      console.warn("Storage warning: Environment variables Supabase tidak memadai atau token JWS tidak valid.");
      return NextResponse.json(
        {
          success: false,
          url: null,
          error:
            "Storage provider belum terkonfigurasi dengan benar (JWS Token / Env vars tidak valid). Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY diatur di preview deployment.",
        },
        { status: 200 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "products";

    if (!file) {
      return NextResponse.json(
        { success: false, url: null, error: "File tidak ditemukan dalam request." },
        { status: 400 }
      );
    }

    // Validasi tipe file
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, url: null, error: "File harus berupa format gambar (JPG, PNG, WEBP)." },
        { status: 400 }
      );
    }

    // Batasi ukuran file (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, url: null, error: "Ukuran gambar melebihi batas maksimal 5MB." },
        { status: 400 }
      );
    }

    // Inisialisasi client Supabase secara dinamis
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const cleanFileName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    const filePath = `${Date.now()}-${cleanFileName}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      const errMsg = uploadError.message || String(uploadError);
      console.error("Supabase Storage Upload Error:", errMsg);

      // Tangani spesifik JWS / JWT error
      if (
        errMsg.toLowerCase().includes("jws") ||
        errMsg.toLowerCase().includes("jwt") ||
        errMsg.toLowerCase().includes("signature")
      ) {
        return NextResponse.json(
          {
            success: false,
            url: null,
            error:
              "Autentikasi storage gagal (JWS Error: Token JSON Web Signature tidak valid). Periksa nilai SUPABASE_ANON_KEY di environment deployment.",
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: false, url: null, error: `Gagal upload: ${errMsg}` },
        { status: 200 }
      );
    }

    const {
      data: { publicUrl },
    } = supabaseClient.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      error: null,
    });
  } catch (err: unknown) {
    const errorStr = err instanceof Error ? err.message : String(err);
    console.error("API /api/upload exception caught:", errorStr);

    // Tangani error JWS / JWT jika dilempar oleh SDK
    if (
      errorStr.toLowerCase().includes("jws") ||
      errorStr.toLowerCase().includes("jwt") ||
      errorStr.toLowerCase().includes("compact")
    ) {
      return NextResponse.json(
        {
          success: false,
          url: null,
          error:
            "Terjadi kesalahan validasi token JWS pada penyedia storage. Aplikasi tetap berjalan aman tanpa crash.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        url: null,
        error: `Terjadi kendala pada pengunggahan gambar: ${errorStr}`,
      },
      { status: 200 }
    );
  }
}
