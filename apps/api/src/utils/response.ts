import type { ApiResponse } from '@pixel-english-town/contracts';

export function response<T>(code: number, message: string, data: T | null): ApiResponse<T> {
  return { code, data, message };
}
