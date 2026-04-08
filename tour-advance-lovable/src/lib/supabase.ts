import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);

// The Next.js / edge-function backend URL for AI operations
export const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? "";
