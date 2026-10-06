import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateComplaintSchema } from '@/lib/validations';

// Helper: Verifikasi apakah request dikirim oleh admin terautentikasi
async function verifyAdminSession() {
  const supabase = createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return { isAuthorized: false, user: null };
  }

  // Cek apakah user ada di tabel public.admins
  const { data: adminRecord } = await supabase
    .from('admins')
    .select('id, email')
    .eq('id', session.user.id)
    .single();

  if (!adminRecord) {
    return { isAuthorized: false, user: session.user };
  }

  return { isAuthorized: true, user: session.user };
}

// GET: Mengambil detail satu keluhan
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const supabase = createServerSupabase();

    // Selalu pakai view complaints_public agar NIP tampil disamarkan tanpa
    // tergantung status login. Sebelumnya endpoint ini mengembalikan NIP
    // lengkap apabila browser pemanggil memiliki sesi admin, sehingga halaman
    // rincian publik ikut menampilkan NIP utuh. NIP lengkap tetap tersedia
    // bagi petugas melalui /api/admin/complaints.
    const { data, error } = await supabase
      .from('complaints_public')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Keluhan tidak ditemukan' }, { status: 404 });
    }

    const complaint = data;

    // Ambil foto-foto keluhan
    const { data: photos } = await supabase
      .from('complaint_photos')
      .select('*')
      .eq('complaint_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...complaint,
        photos: photos || [],
      },
    });
  } catch (err: any) {
    console.error('Error fetching complaint detail:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Memperbarui status keluhan, tanggal selesai, dan catatan admin (HANYA ADMIN)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { isAuthorized } = await verifyAdminSession();

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Akses ditolak: Operasi ini hanya diizinkan untuk Admin resmi.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const supabaseAdmin = createAdminClient();

    // Ambil data keluhan saat ini untuk validasi tanggal
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('complaints')
      .select('tanggal_keluhan, status, tanggal_selesai')
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Laporan keluhan tidak ditemukan' }, { status: 404 });
    }

    const parsed = updateComplaintSchema.safeParse({
      ...body,
      tanggal_keluhan: existing.tanggal_keluhan,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors[0]?.message || 'Data update tidak valid',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    let { status, tanggal_selesai, catatan_admin } = parsed.data;

    // Logika Otomatis:
    // Jika status diubah ke 'selesai' dan tanggal_selesai kosong, isi dengan tanggal hari ini
    if (status === 'selesai' && (!tanggal_selesai || tanggal_selesai === '')) {
      tanggal_selesai = new Date().toISOString().split('T')[0];
    } else if (status !== 'selesai' && (!tanggal_selesai || tanggal_selesai === '')) {
      tanggal_selesai = null;
    }

    // Validasi: tanggal selesai tidak boleh sebelum tanggal keluhan
    if (tanggal_selesai && existing.tanggal_keluhan) {
      if (new Date(tanggal_selesai) < new Date(existing.tanggal_keluhan)) {
        return NextResponse.json(
          { error: 'Tanggal penyelesaian tidak boleh mendahului tanggal keluhan dibuat.' },
          { status: 400 }
        );
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('complaints')
      .update({
        status,
        tanggal_selesai: tanggal_selesai || null,
        catatan_admin: catatan_admin || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating complaint:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Status dan catatan laporan berhasil diperbarui',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error in PATCH complaint:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Menghapus laporan beserta seluruh berkas fotonya di Supabase Storage (HANYA ADMIN)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { isAuthorized } = await verifyAdminSession();

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Akses ditolak: Operasi penghapusan hanya diizinkan untuk Admin resmi.' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 1. Ambil daftar foto yang terhubung untuk dihapus dari Storage
    const { data: photos } = await supabaseAdmin
      .from('complaint_photos')
      .select('storage_path')
      .eq('complaint_id', id);

    const storagePaths = (photos || []).map((p) => p.storage_path).filter(Boolean);

    // 2. Hapus berkas foto dari bucket Supabase Storage
    if (storagePaths.length > 0) {
      const { error: storageDeleteError } = await supabaseAdmin.storage
        .from('complaint-photos')
        .remove(storagePaths);

      if (storageDeleteError) {
        console.warn('Gagal menghapus beberapa file di storage saat delete complaint:', storageDeleteError);
      }
    }

    // 3. Hapus data keluhan dari tabel (foreign key cascade akan otomatis menghapus complaint_photos)
    const { error: deleteError } = await supabaseAdmin
      .from('complaints')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting complaint record:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Laporan dan seluruh berkas fotonya berhasil dihapus secara permanen',
    });
  } catch (err: any) {
    console.error('Error in DELETE complaint:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
