export const formatCurrency = (value: number | string | null | undefined, currency = 'USD'): string => {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number.isFinite(n) ? n : 0);
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

export const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

export const generateOrderNumber = (): string => {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `LX-${ts}${rand}`;
};

export const getSessionId = (): string => {
  const KEY = 'luxe_session_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
};

export const timeAgo = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
};

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * Normalizes a search string for comparison: lowercase, trimmed, with
 * internal whitespace collapsed to single spaces.
 */
export const normalizeSearchTerm = (input: string): string =>
  input.toLowerCase().trim().replace(/\s+/g, ' ');
