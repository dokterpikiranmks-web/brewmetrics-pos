import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://nrjnoowzxwcrfjccpvpj.supabase.co";

// Dummy JWT fallback agar createClient tidak throw 'supabaseKey is required' saat SSR / build time
const defaultDummyKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yam5vb3d6eHdjcmZqY2NwdnBqIiwicm9sZSI6ImFub24ifQ.dummy_token_for_build";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultDummyKey;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Mengecek apakah Anon Key Supabase asli telah dikonfigurasi di file .env
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20
  );
}

/**
 * Mengunggah file gambar ke Supabase Storage pada bucket 'product-images'
 * dan mengembalikan Public URL untuk disimpan ke database.
 */
export async function uploadProductImage(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  try {
    // Validasi konfigurasi Supabase
    if (!isSupabaseConfigured()) {
      return {
        url: null,
        error:
          "NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur di file .env. Masukkan Anon Key dari dashboard Supabase Anda.",
      };
    }

    // Validasi tipe file
    if (!file.type.startsWith("image/")) {
      return { url: null, error: "File yang dipilih harus berupa gambar (JPG, PNG, WEBP)." };
    }

    // Batasi ukuran maksimal 5MB
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: "Ukuran gambar maksimal 5MB." };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const cleanBaseName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .toLowerCase();
    const filePath = `products/${Date.now()}-${cleanBaseName}.${ext}`;

    // Upload ke bucket 'product-images'
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Supabase Storage upload error:", error);
      return { url: null, error: error.message || "Gagal mengunggah gambar ke Supabase Storage." };
    }

    // Ambil Public URL
    const { data: publicUrlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(data.path);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err) {
    console.error("uploadProductImage exception:", err);
    return {
      url: null,
      error: err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah foto.",
    };
  }
}

/**
 * Mengunggah file foto selfie absensi ke Supabase Storage pada bucket 'attendance-photos'
 * dan mengembalikan Public URL untuk disimpan ke tabel 'attendances'.
 * Memiliki fallback cerdas ke data URL jika Supabase Storage belum terkonfigurasi.
 */
export async function uploadAttendancePhoto(
  fileOrBlob: Blob | File | string,
  userId: number
): Promise<{ url: string | null; error: string | null }> {
  try {
    let buffer: Buffer;
    let mimeType = "image/jpeg";
    let base64Fallback = "";

    if (typeof fileOrBlob === "string") {
      base64Fallback = fileOrBlob;
      if (fileOrBlob.startsWith("data:")) {
        const commaIndex = fileOrBlob.indexOf(",");
        if (commaIndex !== -1) {
          const metaPart = fileOrBlob.slice(0, commaIndex);
          const dataPart = fileOrBlob.slice(commaIndex + 1);
          const mimeMatch = metaPart.match(/^data:([^;]+);base64/);
          if (mimeMatch && mimeMatch[1]) {
            mimeType = mimeMatch[1];
          }
          buffer = Buffer.from(dataPart, "base64");
        } else {
          buffer = Buffer.from(fileOrBlob, "base64");
        }
      } else {
        return { url: fileOrBlob, error: null };
      }
    } else {
      const arrayBuffer = await fileOrBlob.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      if (fileOrBlob.type) {
        mimeType = fileOrBlob.type;
      }
    }

    // Jika Supabase belum dikonfigurasi langsung dengan API key asli di environment
    if (!isSupabaseConfigured()) {
      if (base64Fallback) return { url: base64Fallback, error: null };
      const fallbackUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
      return { url: fallbackUrl, error: null };
    }

    const ext = mimeType === "image/png" ? "png" : "jpg";
    const filePath = `selfie/user-${userId}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Supabase attendance-photos upload error:", error);
      return {
        url: null,
        error: `Supabase Storage (attendance-photos): ${error.message || "Gagal mengunggah berkas foto."}`,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(data.path);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: unknown) {
    console.error("uploadAttendancePhoto exception:", err);
    return {
      url: null,
      error:
        err instanceof Error
          ? `Gagal memproses unggah foto: ${err.message}`
          : "Terjadi kesalahan internal saat memproses foto absensi.",
    };
  }
}

