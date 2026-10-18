import { useEffect, useState } from 'react';
import { apiFetch, readApiResponse } from '../api';

const emptyForm = { name: '', cnpj: '' };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminCompanyId, setAdminCompanyId] = useState('');
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });
  const [adminCredentials, setAdminCredentials] = useState(null);

  const loadCompanies = () => apiFetch('/admin/companies')
    .then((response) => readApiResponse(response, 'Não foi possível carregar as empresas.'))
    .then((result) => setCompanies(result.data || []));

  useEffect(() => {
    loadCompanies().catch((loadError) => setError(loadError.message));
  }, []);

  const createCompany = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await apiFetch('/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await readApiResponse(response, 'Não foi possível cadastrar a empresa.');
      setCompanies((current) => [result.data, ...current]);
      setForm(emptyForm);
      setNotice('Empresa cadastrada. Para permitir o acesso, crie um admin vinculado à empresa.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível cadastrar a empresa.');
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async (company, changes) => {
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`/admin/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          cnpj: company.cnpj || '',
          status: changes.status || company.status,
        }),
      });
      const result = await readApiResponse(response, 'Não foi possível atualizar a empresa.');
      setCompanies((current) => current.map((item) => (item.id === company.id ? result.data : item)));
      setNotice(`Empresa "${result.data.name}" atualizada.`);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível atualizar a empresa.');
    }
  };

  const createCompanyAdmin = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setAdminCredentials(null);
    setLoading(true);
    try {
      const response = await apiFetch(`/admin/companies/${adminCompanyId}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      });
      const result = await readApiResponse(response, 'Não foi possível criar o administrador da empresa.');
      setAdminCredentials({ email: result.data.email, password: result.temporary_password });
      setAdminForm({ name: '', email: '' });
      setAdminCompanyId('');
      await loadCompanies();
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível criar o administrador da empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Administração global de empresas</h1>
          <p>Área exclusiva do super admin. Os dados operacionais permanecem isolados por empresa.</p>
        </div>
      </header>

      <div className="card">
        <h2>Cadastrar empresa</h2>
        <form className="page-form company-admin-form" onSubmit={createCompany}>
          <label>
            Nome da empresa
            <input
              required
              maxLength={255}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label>
            CNPJ (opcional)
            <input
              maxLength={18}
              value={form.cnpj}
              onChange={(event) => setForm((current) => ({ ...current, cnpj: event.target.value }))}
            />
          </label>
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Cadastrar empresa'}
          </button>
        </form>
        {error && <div className="form-message error" role="alert">{error}</div>}
        {notice && <div className="form-message" role="status">{notice}</div>}
      </div>

      <div className="card">
        <h2>Empresas cadastradas</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Empresa</th><th>CNPJ</th><th>Usuários</th><th>Situação</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.cnpj || '—'}</td>
                  <td>{company.user_count ?? '—'}</td>
                  <td>{company.status === 'active' ? 'Ativa' : 'Inativa'}</td>
                  <td>
                    <div className="company-row-actions">
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => updateCompany(company, { status: company.status === 'active' ? 'inactive' : 'active' })}
                      >
                        {company.status === 'active' ? 'Desativar' : 'Ativar'}
                      </button>
                      {company.status === 'active' && (
                        <button
                          className="secondary-btn"
                          type="button"
                          onClick={() => setAdminCompanyId((current) => current === company.id ? '' : company.id)}
                        >
                          Criar admin
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!companies.length && <tr><td colSpan="5">Nenhuma empresa cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
        {adminCompanyId && (
          <form className="page-form company-admin-form" onSubmit={createCompanyAdmin}>
            <h3>Criar administrador para {companies.find((company) => company.id === adminCompanyId)?.name}</h3>
            <label>
              Nome
              <input required maxLength={255} value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Email
              <input required type="email" value={adminForm.email} onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar administrador'}
            </button>
          </form>
        )}
        {adminCredentials && (
          <div className="form-message credentials-message" role="status">
            <strong>Administrador criado. Guarde e entregue a senha temporária; ela não será exibida novamente.</strong>
            <span>Email: {adminCredentials.email}</span>
            <code>{adminCredentials.password}</code>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => navigator.clipboard.writeText(`${adminCredentials.email}\n${adminCredentials.password}`)}
            >
              Copiar acesso
            </button>
          </div>
        )}
      </div>
    </>
  );
}
