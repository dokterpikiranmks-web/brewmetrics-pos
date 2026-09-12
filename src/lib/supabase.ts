import { createClient, SupabaseClient } from "@supabase/supabase-js";

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
    let blob: Blob;
    let base64Fallback: string = "";

    if (typeof fileOrBlob === "string") {
      base64Fallback = fileOrBlob;
      if (fileOrBlob.startsWith("data:")) {
        const parts = fileOrBlob.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        return { url: fileOrBlob, error: null };
      }
    } else {
      blob = fileOrBlob;
    }

    // Jika Supabase belum dikonfigurasi langsung dengan API key asli, gunakan fallback
    if (!isSupabaseConfigured()) {
      if (base64Fallback) return { url: base64Fallback, error: null };
      const buffer = await blob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return { url: `data:${blob.type || "image/jpeg"};base64,${base64}`, error: null };
    }

    const ext = blob.type === "image/png" ? "png" : "jpg";
    const filePath = `selfie/user-${userId}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from("attendance-photos")
      .upload(filePath, blob, {
        contentType: blob.type || "image/jpeg",
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.warn("Supabase attendance-photos upload warning, using fallback:", error.message);
      if (base64Fallback) return { url: base64Fallback, error: null };
      const buffer = await blob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      return { url: `data:${blob.type || "image/jpeg"};base64,${base64}`, error: null };
    }

    const { data: publicUrlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(data.path);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err) {
    console.error("uploadAttendancePhoto exception:", err);
    if (typeof fileOrBlob === "string" && fileOrBlob.startsWith("data:")) {
      return { url: fileOrBlob, error: null };
    }
    return {
      url: null,
      error: err instanceof Error ? err.message : "Gagal mengunggah foto absensi.",
    };
  }
}

