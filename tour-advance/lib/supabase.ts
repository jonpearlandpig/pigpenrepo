import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser-safe client (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client (bypasses RLS — server routes only)
export function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Upload a file to Supabase Storage, return its path
export async function uploadFile(
  bucket: "production-riders" | "tech-packets",
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const client = getServiceClient();
  const path = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error } = await client.storage
    .from(bucket)
    .upload(path, fileBuffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

// Get a signed URL for a stored file (valid 1 hour)
export async function getSignedUrl(
  bucket: "production-riders" | "tech-packets",
  path: string
): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }
  return data.signedUrl;
}
