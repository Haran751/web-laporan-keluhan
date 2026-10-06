import crypto from 'crypto';
import { createAdminClient } from './supabase/admin';

// Batas: Maksimal 5 laporan per jam per IP
const MAX_REQUESTS_PER_HOUR = 5;

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const supabase = createAdminClient();
    const ipHash = hashIp(ip);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Hitung jumlah percobaan dalam 1 jam terakhir
    const { count, error } = await supabase
      .from('ip_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo);

    if (error) {
      console.warn('Rate limiter warning (db error, allow request):', error.message);
      return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR };
    }

    const currentCount = count || 0;
    if (currentCount >= MAX_REQUESTS_PER_HOUR) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - currentCount };
  } catch (err) {
    console.warn('Rate limiter check error, bypassing:', err);
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR };
  }
}

export async function recordRateLimitHit(ip: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const ipHash = hashIp(ip);

    await supabase.from('ip_rate_limits').insert({
      ip_hash: ipHash,
    });
  } catch (err) {
    console.warn('Failed to record rate limit hit:', err);
  }
}
