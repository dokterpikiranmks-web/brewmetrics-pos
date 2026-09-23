import { createClient } from '@supabase/supabase-js';

// Helper untuk membersihkan spasi tersembunyi dan tanda kutip ganda/tunggal
const cleanStr = (str?: string) => str ? str.trim().replace(/^["']|["']$/g, '') : '';

const supabaseUrl = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseKey) {
  console.warn("Peringatan: Supabase URL atau Anon Key tidak ditemukan di environment variables.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');