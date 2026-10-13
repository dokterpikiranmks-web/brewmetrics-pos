import { createClient } from "@supabase/supabase-js";

// 1. Helper pelindung dari spasi dan tanda kutip
const cleanStr = (str?: string) => (str ? str.trim().replace(/^["']|["']$/g, "") : "");

/**
 * Validasi apakah token berformat JWT yang valid (3 bagian terpisah titik: Header.Payload.Signature)
 */
export function isValidJwt(token?: string): boolean {
  if (!token) return false;
  const cleaned = cleanStr(token);
  if (cleaned.length < 20) return false;
  const parts = cleaned.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

const supabaseUrl = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseUrl.startsWith("http") && isValidJwt(supabaseKey));
}

if (!isSupabaseConfigured()) {
  console.warn("Peringatan: Supabase URL atau Anon Key tidak valid di environment variables (JWS guard aktif).");
}

// 2. Client Supabase Utama (gunakan dummy JWT valid agar SDK tidak crash saat inisialisasi)
const safeDummyKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJub25lIn0.invalid_signature_dummy_placeholder";

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  isSupabaseConfigured() ? supabaseKey : safeDummyKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// 3. Fungsi Upload Gambar Produk (Tipe kembalian disesuaikan dengan ProductRecipeModal)
export async function uploadProductImage(
  file: File | Blob,
  fileName?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    // 1. Jika di browser, coba gunakan route /api/upload terlebih dahulu
    if (typeof window !== "undefined" && typeof FormData !== "undefined" && file instanceof File) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "products");

        const apiRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && json.url) {
            return { url: json.url, error: null };
          }
          if (json.error) {
            return { url: null, error: json.error };
          }
        }
      } catch (apiErr) {
        console.warn("Upload via /api/upload gagal, beralih ke direct storage:", apiErr);
      }
    }

    // 2. Validasi kesiapan konfigurasi token Supabase
    if (!isSupabaseConfigured()) {
      return {
        url: null,
        error:
          "Storage Supabase belum terkonfigurasi dengan Anon Key (JWT) yang valid pada environment ini. Error JWS berhasil dicegah.",
      };
    }

    const name = fileName || `product_${Date.now()}`;

    // Upload langsung ke Supabase Storage bucket 'products'
    const { error } = await supabase.storage.from("products").upload(name, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) {
      console.error("Gagal upload gambar produk:", error.message);
      const isJwsError =
        error.message?.toLowerCase().includes("jws") ||
        error.message?.toLowerCase().includes("jwt") ||
        error.message?.toLowerCase().includes("compact");

      if (isJwsError) {
        return {
          url: null,
          error: "Autentikasi storage ditolak (JWS Error: Token Supabase tidak valid). Periksa NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        };
      }
      return { url: null, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("products").getPublicUrl(name);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error("Error pada uploadProductImage:", error);
    const errStr = error instanceof Error ? error.message : "Unknown error occurred";
    if (
      errStr.toLowerCase().includes("jws") ||
      errStr.toLowerCase().includes("jwt") ||
      errStr.toLowerCase().includes("compact")
    ) {
      return {
        url: null,
        error: "Terjadi JWS Error pada kredensial storage. Operasi dihentikan tanpa menyebabkan crash aplikasi.",
      };
    }
    return {
      url: null,
      error: errStr,
    };
  }
}