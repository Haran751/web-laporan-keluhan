import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAdminSchema } from '@/lib/validations';

// Helper: Verifikasi apakah request dikirim oleh admin terautentikasi
async function verifyAdminSession() {
  const supabase = createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { isAuthorized: false, currentUser: null };
  }

  const { data: adminRecord } = await supabase
    .from('admins')
    .select('id, email')
    .eq('id', session.user.id)
    .single();

  if (!adminRecord) {
    return { isAuthorized: false, currentUser: session.user };
  }

  return { isAuthorized: true, currentUser: session.user };
}

// GET: Daftar semua admin resmi
export async function GET() {
  try {
    const { isAuthorized } = await verifyAdminSession();
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya untuk admin' }, { status: 403 });
    }

    const supabase = createServerSupabase();
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: admins || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Menambah admin baru menggunakan service role (supabase.auth.admin)
export async function POST(req: NextRequest) {
  try {
    const { isAuthorized } = await verifyAdminSession();
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya untuk admin' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createAdminSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Data tidak valid' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabaseAdmin = createAdminClient();

    // 1. Buat user di Supabase Auth melalui auth.admin (Hanya di server)
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json(
        { error: `Gagal membuat akun auth: ${createError.message}` },
        { status: 400 }
      );
    }

    // 2. Masukkan ID user ke tabel public.admins
    const { data: adminRecord, error: tableError } = await supabaseAdmin
      .from('admins')
      .insert({
        id: userData.user.id,
        email: email,
      })
      .select()
      .single();

    if (tableError) {
      // Rollback pembuatan user jika pencatatan tabel gagal
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json(
        { error: `Gagal mendaftarkan admin ke tabel: ${tableError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin baru berhasil didaftarkan',
      data: adminRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Menghapus akun admin (dengan proteksi: tidak boleh menghapus diri sendiri)
export async function DELETE(req: NextRequest) {
  try {
    const { isAuthorized, currentUser } = await verifyAdminSession();
    if (!isAuthorized || !currentUser) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya untuk admin' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id');

    if (!targetId) {
      return NextResponse.json({ error: 'ID admin wajib disertakan' }, { status: 400 });
    }

    // KEAMANAN KRITIS: Admin tidak boleh menghapus dirinya sendiri!
    if (targetId === currentUser.id) {
      return NextResponse.json(
        { error: 'Tindakan dilarang: Anda tidak dapat menghapus akun admin Anda sendiri.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Hapus dari Supabase Auth (FK cascade akan menghapus dari tabel admins)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetId);

    if (deleteAuthError) {
      // Coba hapus langsung dari tabel admins jika auth user sudah tidak ada
      await supabaseAdmin.from('admins').delete().eq('id', targetId);
    } else {
      await supabaseAdmin.from('admins').delete().eq('id', targetId);
    }

    return NextResponse.json({
      success: true,
      message: 'Admin berhasil dihapus dari sistem',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
