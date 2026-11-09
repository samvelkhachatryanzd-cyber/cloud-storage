const SESSION_KEY = 'session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function api(path, options = {}) {
  const session = getSession();
  const headers = { ...(options.headers || {}) };
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/api${path}`, { ...options, headers });

  if (response.status === 401 && session) {
    clearSession();
    window.location.reload();
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data && data.error ? data.error : `Request failed with status ${response.status}`);
  }
  return response;
}

export async function apiJson(path, options) {
  const response = await api(path, options);
  return response.json();
}
