import { CapacitorHttp } from '@capacitor/core';
import { isNativePlatform } from './platform';

/**
 * Outcome of a GET request for JSON. Network problems are values, not exceptions, so callers
 * can show a fitting message instead of crashing.
 */
export type HttpJsonResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; reason: 'offline' | 'timeout' | 'http' | 'invalid'; status?: number };

export interface HttpGetOptions {
  /** Request headers (e.g. a User-Agent). Browsers may ignore some of them. */
  headers?: Record<string, string>;
  timeoutMs: number;
  /** Aborting rejects the promise with an `AbortError` (the caller cancelled). */
  signal?: AbortSignal;
}

/**
 * GET a JSON document. On the device the request goes through Capacitor's native HTTP client,
 * which allows a proper User-Agent and is not subject to browser CORS rules; the web build
 * (development only) uses fetch. Nothing is cached and no cookies are sent.
 */
export async function httpGetJson(url: string, options: HttpGetOptions): Promise<HttpJsonResult> {
  return isNativePlatform() ? nativeGet(url, options) : webGet(url, options);
}

async function nativeGet(url: string, options: HttpGetOptions): Promise<HttpJsonResult> {
  try {
    const response = await CapacitorHttp.get({
      url,
      headers: { Accept: 'application/json', ...options.headers },
      connectTimeout: options.timeoutMs,
      readTimeout: options.timeoutMs,
      responseType: 'json',
    });
    if (options.signal?.aborted) throw abortError();
    return toResult(response.status, response.data);
  } catch (error) {
    if (isAbort(error)) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return {
      ok: false,
      reason: message.includes('timed out') || message.includes('timeout') ? 'timeout' : 'offline',
    };
  }
}

async function webGet(url: string, options: HttpGetOptions): Promise<HttpJsonResult> {
  const controller = new AbortController();
  const state = { timedOut: false };
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const forward = () => {
    controller.abort();
  };
  options.signal?.addEventListener('abort', forward);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      return response.ok
        ? { ok: false, reason: 'invalid' }
        : { ok: false, reason: 'http', status: response.status };
    }
    return toResult(response.status, data);
  } catch (error) {
    if (options.signal?.aborted) throw abortError();
    if (state.timedOut) return { ok: false, reason: 'timeout' };
    return isAbort(error) ? { ok: false, reason: 'timeout' } : { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forward);
  }
}

function toResult(status: number, data: unknown): HttpJsonResult {
  if (status >= 200 && status < 300) {
    return typeof data === 'object' && data !== null
      ? { ok: true, status, data }
      : { ok: false, reason: 'invalid' };
  }
  // Some APIs answer "not found" with a JSON body and a 404 status.
  if (status === 404 && typeof data === 'object' && data !== null)
    return { ok: true, status, data };
  return { ok: false, reason: 'http', status };
}

function abortError(): Error {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
