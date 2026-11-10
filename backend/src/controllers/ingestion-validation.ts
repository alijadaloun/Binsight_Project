import { HttpError } from '../middleware/http-error.js';

export function requireObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

export function requireId(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 50) {
    throw new HttpError(400, `${name} must be a nonempty string of at most 50 characters.`);
  }
  return value;
}

export function optionalNumber(value: unknown, name: string, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      Number(value.toFixed(2)) !== value) {
    throw new HttpError(400, `${name} must be a number from ${min} to ${max} with at most two decimal places.`);
  }
  return value;
}

export function requireTimestamp(value: unknown): Date {
  if (typeof value !== 'string') throw new HttpError(400, 'timestamp must be a valid datetime string.');

  const sql = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (sql) {
    const parts = sql.slice(1).map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
    if (date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 &&
        date.getDate() === parts[2] && date.getHours() === parts[3] &&
        date.getMinutes() === parts[4] && date.getSeconds() === parts[5]) return date;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new HttpError(400, 'timestamp must be a valid YYYY-MM-DD HH:mm:ss or timezone-qualified ISO datetime.');
}
