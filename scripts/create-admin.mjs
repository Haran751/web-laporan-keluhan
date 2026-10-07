// ==============================================================================
// BOOTSTRAP SCRIPT: PEMBUATAN ADMIN PERTAMA SIPeKa
// Penggunaan: node scripts/create-admin.mjs <email> <password>
// Contoh: node scripts/create-admin.mjs admin@kemenkes.go.id Password123!
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Baca file .env.local atau .env secara manual
function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  const envVars = {};

  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          envVars[key] = val;
        }
      }
      break;
    }
  }

  return envVars;
}

const env = loadEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project-id')) {
  console.error('\n❌ ERROR: Supabase URL atau Service Role Key belum diatur dengan benar di .env.local');
  console.error('Pastikan Anda telah mengisi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args[0] || 'admin@kemenkes.go.id';
const password = args[1] || 'AdminKemenkes123!';

async function createAdmin() {
  console.log('\n🚀 Memulai inisialisasi akun admin PADUKA...');
  console.log(`📌 Target Email: ${email}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Cek apakah user sudah terdaftar di Supabase Auth
    let userId = null;
    const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();

    if (!listError && usersList && usersList.users) {
      const existingUser = usersList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        userId = existingUser.id;
        console.log(`ℹ️  User Auth sudah terdaftar dengan ID: ${userId}`);
      }
    }

    // 2. Buat akun baru jika belum ada
    if (!userId) {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (createError) {
        throw new Error(`Gagal membuat user auth: ${createError.message}`);
      }

      userId = newUser.user.id;
      console.log(`✅ Berhasil membuat akun Supabase Auth dengan ID: ${userId}`);
    }

    // 3. Masukkan ke tabel public.admins
    const { error: adminTableError } = await supabase
      .from('admins')
      .upsert({ id: userId, email: email }, { onConflict: 'id' });

    if (adminTableError) {
      throw new Error(`Gagal mencatat admin di tabel admins: ${adminTableError.message}`);
    }

    console.log('\n======================================================');
    console.log('🎉 AKUN ADMIN BERHASIL DIBUAT / DIAKTIFKAN!');
    console.log('======================================================');
    console.log(`Email    : ${email}`);
    console.log(`Password : ${password}`);
    console.log(`Halaman  : http://localhost:3000/admin/login`);
    console.log('======================================================\n');
  } catch (err) {
    console.error(`\n❌ Gagal membuat admin: ${err.message}\n`);
    process.exit(1);
  }
}

createAdmin();
