import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadUrlRequestSchema } from '@/lib/validations';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import crypto from 'crypto';

// ALUR KEAMANAN UPLOAD FOTO:
// 1. Client meminta signed upload URL ke endpoint ini (server cek rate limit, jumlah file, dan tipe)
// 2. Server menghasilkan URL bertanda tangan khusus (signed URL) untuk bucket Supabase Storage
// 3. Client mengunggah langsung ke Supabase Storage via signed URL (menghindari batas body 4.5MB Vercel serverless)
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rateLimit = await checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Batas pengiriman laporan tercapai (maksimal 5 laporan per jam per koneksi IP). Silakan coba lagi nanti.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = uploadUrlRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors[0]?.message || 'Permintaan upload tidak valid',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const signedUrls = [];

    for (const file of parsed.data.files) {
      // Buat nama berkas acak yang aman dengan ekstensi asli
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'jpg';
      const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const randomId = crypto.randomUUID();
      const storagePath = `complaints/${Date.now()}-${randomId}.${cleanExt}`;

      // Buat signed upload URL yang berlaku 15 menit
      const { data, error } = await supabase.storage
        .from('complaint-photos')
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        console.error('Error creating signed upload URL:', error);
        return NextResponse.json(
          { error: `Gagal mempersiapkan jalur upload untuk ${file.filename}` },
          { status: 500 }
        );
      }

      // Dapatkan URL publik untuk referensi tampilan gambar
      const { data: publicUrlData } = supabase.storage
        .from('complaint-photos')
        .getPublicUrl(storagePath);

      signedUrls.push({
        originalName: file.filename,
        storagePath: storagePath,
        signedUrl: data.signedUrl,
        token: data.token,
        publicUrl: publicUrlData.publicUrl,
      });
    }

    return NextResponse.json({
      success: true,
      data: signedUrls,
    });
  } catch (err: any) {
    console.error('Upload URL generation error:', err);
    return NextResponse.json(
      { error: err.message || 'Terjadi kesalahan sistem saat memproses upload' },
      { status: 500 }
    );
  }
}
