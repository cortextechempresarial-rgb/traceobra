import { useEffect, useState } from 'react';
import { apiFetch, readApiResponse } from '../api';
import { screenOptions } from '../screenPermissions';

const emptyForm = { name: '', email: '', role: 'user', screen_permissions: [] };

function ScreenPicker({ value, onChange, disabled = false }) {
  const toggle = (screen) => {
    onChange(value.includes(screen)
      ? value.filter((item) => item !== screen)
      : [...value, screen]);
  };

  return (
    <fieldset className="screen-permission-picker" disabled={disabled}>
      <legend>Telas permitidas</legend>
      {screenOptions.map(({ key, label }) => (
        <label key={key}>
          <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

export default function CompanyUsersPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [edits, setEdits] = useState({});
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsers = () => apiFetch('/admin/users')
    .then((response) => readApiResponse(response, 'Não foi possível carregar os usuários.'))
    .then((result) => {
      setUsers(result.data || []);
      setEdits(Object.fromEntries((result.data || []).map((user) => [user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
        screen_permissions: user.screen_permissions || [],
        status: user.status,
      }])));
    });

  useEffect(() => {
    loadUsers().catch((loadError) => setError(loadError.message));
  }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setCreatedCredentials(null);
    setLoading(true);
    try {
      const response = await apiFetch('/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await readApiResponse(response, 'Não foi possível cadastrar o usuário.');
      setUsers((current) => [result.data, ...current]);
      setEdits((current) => ({
        ...current,
        [result.data.id]: {
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
          screen_permissions: result.data.screen_permissions || [],
          status: result.data.status,
        },
      }));
      setCreatedCredentials({ email: result.data.email, password: result.temporary_password });
      setForm(emptyForm);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível cadastrar o usuário.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (userId, field, value) => {
    setEdits((current) => ({ ...current, [userId]: { ...current[userId], [field]: value } }));
  };

  const saveUser = async (userId) => {
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits[userId]),
      });
      const result = await readApiResponse(response, 'Não foi possível atualizar o usuário.');
      setUsers((current) => current.map((user) => (user.id === userId ? result.data : user)));
      setNotice(`Acesso de ${result.data.name} atualizado.`);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível atualizar o usuário.');
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Usuários da empresa</h1>
          <p>Crie contas e escolha quais módulos cada pessoa pode consultar. Administradores da empresa têm acesso a todos os módulos.</p>
        </div>
      </header>

      <div className="card">
        <h2>Cadastrar usuário</h2>
        <form className="page-form company-user-form" onSubmit={createUser}>
          <label>
            Nome completo
            <input required maxLength={255} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Email
            <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Função
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="user">Usuário</option>
              <option value="engineer">Engenheiro</option>
              <option value="admin">Admin da empresa</option>
            </select>
          </label>
          <ScreenPicker
            value={form.screen_permissions}
            onChange={(permissions) => setForm((current) => ({ ...current, screen_permissions: permissions }))}
            disabled={form.role === 'admin'}
          />
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar usuário'}
          </button>
        </form>
        {createdCredentials && (
          <div className="form-message credentials-message" role="status">
            <strong>Conta criada. Copie a senha temporária e entregue-a ao usuário; ela não será exibida novamente.</strong>
            <span>Email: {createdCredentials.email}</span>
            <code>{createdCredentials.password}</code>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => navigator.clipboard.writeText(`${createdCredentials.email}\n${createdCredentials.password}`)}
            >
              Copiar acesso
            </button>
          </div>
        )}
        {error && <div className="form-message error" role="alert">{error}</div>}
        {notice && <div className="form-message" role="status">{notice}</div>}
      </div>

      <div className="card">
        <h2>Usuários cadastrados</h2>
        <div className="company-users-list">
          {users.map((user) => {
            const edit = edits[user.id] || {};
            const isCurrentUser = user.id === currentUser?.id;
            return (
              <section className="company-user-editor" key={user.id}>
                <div className="company-user-editor-heading">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <span>{user.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div className="company-user-form-grid">
                  <label>
                    Nome
                    <input value={edit.name || ''} onChange={(event) => updateField(user.id, 'name', event.target.value)} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={edit.email || ''} onChange={(event) => updateField(user.id, 'email', event.target.value)} />
                  </label>
                  <label>
                    Função
                    <select
                      value={edit.role || 'user'}
                      disabled={isCurrentUser}
                      onChange={(event) => updateField(user.id, 'role', event.target.value)}
                    >
                      <option value="user">Usuário</option>
                      <option value="engineer">Engenheiro</option>
                      <option value="admin">Admin da empresa</option>
                    </select>
                  </label>
                  <label>
                    Situação
                    <select
                      value={edit.status || 'active'}
                      disabled={isCurrentUser}
                      onChange={(event) => updateField(user.id, 'status', event.target.value)}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>
                  <ScreenPicker
                    value={edit.screen_permissions || []}
                    disabled={edit.role === 'admin'}
                    onChange={(permissions) => updateField(user.id, 'screen_permissions', permissions)}
                  />
                  <button className="primary-btn" type="button" onClick={() => saveUser(user.id)}>Salvar alterações</button>
                </div>
              </section>
            );
          })}
          {!users.length && <p>Nenhum usuário cadastrado nesta empresa.</p>}
        </div>
      </div>
    </>
  );
}
