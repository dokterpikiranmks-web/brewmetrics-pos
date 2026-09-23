import { createClient } from '@supabase/supabase-js';

// 1. Helper pelindung dari spasi dan tanda kutip
const cleanStr = (str?: string) => str ? str.trim().replace(/^["']|["']$/g, '') : '';

const supabaseUrl = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseKey) {
  console.warn("Peringatan: Supabase URL atau Anon Key tidak ditemukan di environment variables.");
}

// 2. Client Supabase Utama
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);

// 3. Fungsi Upload Gambar Produk (Tipe kembalian disesuaikan dengan ProductRecipeModal)
export async function uploadProductImage(
  file: File | Blob, 
  fileName?: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const name = fileName || `product_${Date.now()}`;
    
    // Asumsi nama bucket adalah 'products'. Sesuaikan jika berbeda.
    const { error } = await supabase.storage
      .from('products') 
      .upload(name, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error("Gagal upload gambar produk:", error.message);
      return { url: null, error: new Error(error.message) };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(name);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error("Error pada uploadProductImage:", error);
    return { 
      url: null, 
      error: error instanceof Error ? error : new Error("Unknown error occurred") 
    };
  }
}