import { getToken, logout } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function readApiResponse(response, fallbackMessage = 'Não foi possível concluir a solicitação.') {
  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : {};
  } catch {
    const hint = body.trimStart().startsWith('<')
      ? 'A API retornou HTML em vez de JSON. Verifique se o backend está atualizado e se as migrations do banco foram aplicadas.'
      : 'A API retornou uma resposta inválida.';
    throw new Error(`${hint} (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(result.message || fallbackMessage);
  }
  if (result.ok === false) {
    throw new Error(result.message || fallbackMessage);
  }
  return result;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && token) logout();
  return response;
}