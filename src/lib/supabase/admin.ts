import { createClient } from '@supabase/supabase-js';

// PERHATIAN KEAMANAN:
// Client ini HANYA digunakan di environment server (Route Handlers / Server Actions).
// SUPABASE_SERVICE_ROLE_KEY tidak boleh diekspos ke client-side browser.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL atau Service Role Key belum dikonfigurasi di environment variable.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
