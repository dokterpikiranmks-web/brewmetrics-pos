import { createClient } from '@supabase/supabase-js';

// 1. Helper pelindung dari spasi dan tanda kutip (Solusi API Key)
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

// 3. Fungsi Upload Gambar Produk (Fungsi yang tidak sengaja terhapus)
export async function uploadProductImage(file: File | Blob, fileName?: string): Promise<string | null> {
  try {
    const name = fileName || `product_${Date.now()}`;
    
    // Ganti 'products' dengan nama bucket gambar produk Anda jika sebelumnya berbeda
    const { data, error } = await supabase.storage
      .from('products') 
      .upload(name, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error("Gagal upload gambar produk:", error.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(name);

    return publicUrl;
  } catch (error) {
    console.error("Error pada uploadProductImage:", error);
    return null;
  }
}