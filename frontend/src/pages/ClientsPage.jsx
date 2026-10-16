import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', status: 'active' });

  const loadClients = () => {
    apiFetch('/clients')
      .then((res) => res.json())
      .then((json) => setClients(json.data || []));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await apiFetch('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', email: '', phone: '', status: 'active' });
    loadClients();
  };

  return (
    <>
      <header className="page-header">
        <h1>Clientes</h1>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Novo cliente</button>
      </header>

      <div className="card">
        <h3>Cadastro rápido</h3>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do cliente" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cliente@email.com" />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit">Salvar cliente</button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>{client.name}</td>
                <td>{client.email || '-'}</td>
                <td>{client.phone || '-'}</td>
                <td><span className={`badge ${client.status === 'active' ? 'success' : 'danger'}`}>{client.status === 'active' ? 'Ativo' : 'Inativo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
