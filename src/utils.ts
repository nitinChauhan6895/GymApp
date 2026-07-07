import type { MemberStatus } from './types';

/** Format a Date as local YYYY-MM-DD. */
export function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return fmtISO(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Add months, clamping to end of month (Jan 31 + 1mo = Feb 28/29). */
export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return fmtISO(d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return fmtISO(d);
}

/** Age in whole years from an ISO date of birth; null if missing/invalid. */
export function ageOf(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const b = parseISO(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** Whole days from today until the given date. 0 = today, negative = past. */
export function daysUntil(iso: string): number {
  const target = parseISO(iso).getTime();
  const today = parseISO(todayISO()).getTime();
  return Math.round((target - today) / 86400000);
}

export function statusOf(endDate: string | null | undefined): MemberStatus {
  if (!endDate) return 'none';
  const d = daysUntil(endDate);
  if (d < 0) return 'expired';
  if (d <= 7) return 'expiring';
  return 'active';
}

export const STATUS_LABEL: Record<MemberStatus, string> = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
  none: 'No Membership',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return parseISO(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function money(n: number): string {
  return inr.format(Math.round(n || 0));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Normalize a phone number for duplicate comparison. */
export function normPhone(p: string): string {
  const digits = (p || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Read and downscale an image file into a small data URL. */
export function fileToDataUrl(file: File, maxSize = 384): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

export function telLink(phone: string): string {
  return `tel:${(phone || '').replace(/[^+\d]/g, '')}`;
}

export function whatsappLink(phone: string, message: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits; // default to India country code
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
