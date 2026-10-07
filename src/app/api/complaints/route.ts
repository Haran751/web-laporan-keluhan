import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createComplaintSchema } from '@/lib/validations';
import { cariPegawai } from '@/lib/pegawai';
import { checkRateLimit, recordRateLimitHit, getClientIp } from '@/lib/rate-limiter';

// GET: Mengambil daftar laporan publik (NIP otomatis disamarkan melalui view complaints_public)
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // 1. Ambil statistik ringkas untuk banner status
    const { data: statsData } = await supabase
      .from('complaints_public')
      .select('status');

    const stats = {
      total: statsData?.length || 0,
      menunggu: statsData?.filter((item) => item.status === 'menunggu').length || 0,
      diproses: statsData?.filter((item) => item.status === 'diproses').length || 0,
      selesai: statsData?.filter((item) => item.status === 'selesai').length || 0,
    };

    // 2. Susun query terfilter untuk complaints_public
    let query = supabase
      .from('complaints_public')
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
        `nama.ilike.${term},nama_barang.ilike.${term},lokasi.ilike.${term},nomor_laporan.ilike.${term},tim_kerja.ilike.${term}`
      );
    }

    // Urutkan dari laporan terbaru
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: complaints, count, error } = await query;

    if (error) {
      console.error('Error fetching complaints:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Ambil foto untuk setiap complaint yang ditemukan
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

    const enrichedComplaints = (complaints || []).map((c) => ({
      ...c,
      photos: photosMap[c.id] || [],
    }));

    return NextResponse.json({
      success: true,
      data: enrichedComplaints,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats,
    });
  } catch (err: any) {
    console.error('Error in complaints GET handler:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Membuat keluhan baru (HANYA menggunakan Service Role Key di server)
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rateLimit = await checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            'Batas pengiriman laporan tercapai (maksimal 5 laporan per jam per koneksi IP). Silakan tunggu sebelum mengirim laporan kembali.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    // 1. Honeypot check: Jika bot mengisi field tersembunyi, tolak diam-diam
    if (body.honeypot && String(body.honeypot).trim() !== '') {
      console.warn('Bot detected via honeypot:', ip);
      return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 });
    }

    // 2. Validasi input menggunakan Zod
    const parsed = createComplaintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors[0]?.message || 'Data formulir tidak valid',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { nama, nip, nama_barang, lokasi, deskripsi, tanggal_keluhan, photos } = parsed.data;

    // Tim kerja ditentukan otomatis dari master data pegawai (server-authoritative)
    const pegawai = cariPegawai(nip);
    if (!pegawai) {
      return NextResponse.json(
        { error: 'Nama dan NIP tidak sesuai dengan data pegawai resmi' },
        { status: 400 }
      );
    }
    const timKerjaResmi = pegawai.timKerja;

    // Pastikan foto minimal 3
    if (photos.length < 3) {
      return NextResponse.json(
        { error: 'Wajib menyertakan minimal 3 foto bukti fisik kerusakan' },
        { status: 400 }
      );
    }

    // 3. Masukkan ke database via Service Role Admin
    const supabaseAdmin = createAdminClient();

    const { data: newComplaint, error: complaintError } = await supabaseAdmin
      .from('complaints')
      .insert({
        nama,
        nip,
        tim_kerja: timKerjaResmi,
        nama_barang,
        lokasi,
        deskripsi,
        tanggal_keluhan,
        status: 'menunggu',
      })
      .select()
      .single();

    if (complaintError || !newComplaint) {
      console.error('Database error inserting complaint:', complaintError);
      return NextResponse.json(
        { error: 'Gagal mencatat data keluhan ke dalam basis data' },
        { status: 500 }
      );
    }

    // 4. Masukkan foto-foto terkait
    const photoRecords = photos.map((p) => ({
      complaint_id: newComplaint.id,
      storage_path: p.storage_path,
      url: p.url,
    }));

    const { data: insertedPhotos, error: photoError } = await supabaseAdmin
      .from('complaint_photos')
      .insert(photoRecords)
      .select();

    if (photoError) {
      console.error('Error inserting photos:', photoError);
      // Data keluhan tetap tersimpan, tapi berikan log
    }

    // 5. Catat rate limit hit
    await recordRateLimitHit(ip);

    return NextResponse.json({
      success: true,
      message: 'Laporan pengaduan berhasil dikirim dan diverifikasi',
      data: {
        ...newComplaint,
        photos: insertedPhotos || [],
      },
    });
  } catch (err: any) {
    console.error('Error in complaints POST handler:', err);
    return NextResponse.json(
      { error: err.message || 'Terjadi kendala internal server saat memproses laporan' },
      { status: 500 }
    );
  }
}
