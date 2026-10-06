import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Endpoint pembersih: Menghapus foto yang terlanjur diunggah jika proses pelaporan gagal di tengah jalan
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paths: string[] = body.paths || [];

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada foto yang perlu dibersihkan' });
    }

    // Pastikan path hanya berada di dalam folder complaints/ untuk mencegah penghapusan file yang tidak sah
    const safePaths = paths.filter(
      (p) => typeof p === 'string' && p.startsWith('complaints/') && !p.includes('..')
    );

    if (safePaths.length > 0) {
      const supabase = createAdminClient();
      const { error } = await supabase.storage.from('complaint-photos').remove(safePaths);
      if (error) {
        console.warn('Gagal menghapus beberapa berkas foto sisa:', error.message);
      }
    }

    return NextResponse.json({ success: true, cleanedCount: safePaths.length });
  } catch (err: any) {
    console.error('Error cleanup photos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
