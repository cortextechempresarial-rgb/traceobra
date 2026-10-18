import { useState } from 'react';
import { apiFetch, readApiResponse } from '../api';

const initialForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function AccountSecurityPage() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (form.newPassword !== form.confirmPassword) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch('/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const result = await readApiResponse(response, 'Não foi possível alterar a senha.');
      setForm(initialForm);
      setNotice(result.message || 'Senha alterada com sucesso.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível alterar a senha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Segurança da conta</h1>
          <p>Altere sua senha informando primeiro a senha atual.</p>
        </div>
      </header>

      <div className="card account-security-card">
        <form className="account-security-form" onSubmit={changePassword}>
          <label>
            Senha atual
            <input
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.newPassword}
              onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
            />
          </label>
          <label>
            Confirme a nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
            />
          </label>
          <p className="account-security-hint">Use uma senha com pelo menos 8 caracteres.</p>
          {error && <div className="form-message error" role="alert">{error}</div>}
          {notice && <div className="form-message" role="status">{notice}</div>}
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </>
  );
}
