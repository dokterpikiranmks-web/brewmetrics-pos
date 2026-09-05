import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  return Response.json(
    { error: "Fitur reseed demo telah dinonaktifkan. Seluruh data murni berasal dari database Supabase." },
    { status: 403 }
  );
}

