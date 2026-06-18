import { createClient } from '@supabase/supabase-js'

// Next.js prerenders pages at build time when these environment variables may not be set yet.
// We provide placeholder values to prevent initialization crashes during building.
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-anon-key'

// Proactively normalize URL to handle trailing slashes or subpaths (like /rest/v1/)
supabaseUrl = supabaseUrl.trim()
if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.slice(0, -9)
} else if (supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.slice(0, -8)
}
if (supabaseUrl.endsWith('/')) {
  supabaseUrl = supabaseUrl.slice(0, -1)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
