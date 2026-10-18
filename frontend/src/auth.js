export function getStoredUser() {
  try {
    const raw = localStorage.getItem('traceobra_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem('traceobra_token');
}

export function getSelectedCompanyId() {
  return localStorage.getItem('traceobra_company_id');
}

export function logout() {
  localStorage.removeItem('traceobra_token');
  localStorage.removeItem('traceobra_user');
  localStorage.removeItem('traceobra_company_id');
  window.location.href = '/';
}
