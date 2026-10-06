import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

// Helper: Verifikasi admin terautentikasi
async function verifyAdminSession() {
  const supabase = createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return false;
  }

  const { data: adminRecord } = await supabase
    .from('admins')
    .select('id')
    .eq('id', session.user.id)
    .single();

  return Boolean(adminRecord);
}

// GET: Mengambil daftar laporan LENGKAP dengan NIP UTUH untuk dashboard admin
export async function GET(req: NextRequest) {
  try {
    const isAuthorized = await verifyAdminSession();
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Akses ditolak: Hanya untuk admin' }, { status: 403 });
    }

    const supabase = createServerSupabase();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)));
    const offset = (page - 1) * limit;

    // 1. Hitung statistik menyeluruh
    const { data: allComplaints } = await supabase
      .from('complaints')
      .select('status');

    const stats = {
      total: allComplaints?.length || 0,
      menunggu: allComplaints?.filter((c) => c.status === 'menunggu').length || 0,
      diproses: allComplaints?.filter((c) => c.status === 'diproses').length || 0,
      selesai: allComplaints?.filter((c) => c.status === 'selesai').length || 0,
    };

    // 2. Filter data complaints (dengan NIP LENGKAP)
    let query = supabase
      .from('complaints')
      .select('*', { count: 'exact' });

    if (status && ['menunggu', 'diproses', 'selesai'].includes(status)) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('tanggal_keluhan', startDate);
    }

    if (endDate) {
      query = query.lte('tanggal_keluhan', endDate);
    }

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `nama.ilike.${term},nip.ilike.${term},nama_barang.ilike.${term},lokasi.ilike.${term},nomor_laporan.ilike.${term},tim_kerja.ilike.${term}`
      );
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: complaints, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ambil foto terkait
    const complaintIds = (complaints || []).map((c) => c.id);
    let photosMap: Record<string, any[]> = {};

    if (complaintIds.length > 0) {
      const { data: photos } = await supabase
        .from('complaint_photos')
        .select('*')
        .in('complaint_id', complaintIds);

      if (photos) {
        photos.forEach((photo) => {
          if (!photosMap[photo.complaint_id]) {
            photosMap[photo.complaint_id] = [];
          }
          photosMap[photo.complaint_id].push(photo);
        });
      }
    }

    const enriched = (complaints || []).map((c) => ({
      ...c,
      photos: photosMap[c.id] || [],
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit) || 1,
      },
      stats,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
