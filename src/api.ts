/** Small fetch wrapper that surfaces the server's JSON error message. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    headers: isForm || !init.body ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const send = <T = unknown>(method: 'POST' | 'PUT' | 'DELETE', path: string, payload?: unknown) =>
  api<T>(path, { method, body: payload === undefined ? undefined : JSON.stringify(payload) });
