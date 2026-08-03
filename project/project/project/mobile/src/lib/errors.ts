// ============================================================
// Centralized error handling for Supabase queries
// ============================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | null = null,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  PGRST116: 'No data found.',
  42501: 'You do not have permission to perform this action.',
  23505: 'This item already exists.',
  23503: 'This item is referenced by other records and cannot be changed.',
  'network-request-failed': 'Network error. Check your connection and try again.',
  'auth/invalid-credentials': 'Invalid email or password.',
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; status?: number };
    const code = e.code ?? null;
    const friendly = code ? FRIENDLY_MESSAGES[code] : undefined;
    return new ApiError(friendly ?? e.message ?? 'An unexpected error occurred.', code, e.status ?? null);
  }

  if (error instanceof Error) return new ApiError(error.message);
  return new ApiError('An unexpected error occurred.');
}

export function getErrorMessage(error: unknown): string {
  return toApiError(error).message;
}
