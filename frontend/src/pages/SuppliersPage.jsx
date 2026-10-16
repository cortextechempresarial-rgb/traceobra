import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '' });

  const loadSuppliers = () => {
    apiFetch('/suppliers')
      .then((res) => res.json())
      .then((json) => setSuppliers(json.data || []));
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await apiFetch('/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', contact: '', email: '', phone: '' });
    loadSuppliers();
  };

  return (
    <>
      <header className="page-header">
        <h1>Fornecedores</h1>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Novo fornecedor</button>
      </header>

      <div className="card">
        <h3>Cadastro de parceiros</h3>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa" />
          </div>
          <div className="field">
            <label>Contato</label>
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Responsável" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit">Salvar fornecedor</button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Contato</th>
              <th>Email</th>
              <th>Telefone</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td>{supplier.name}</td>
                <td>{supplier.contact || '-'}</td>
                <td>{supplier.email || '-'}</td>
                <td>{supplier.phone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
