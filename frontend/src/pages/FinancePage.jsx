import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function FinancePage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ type: 'income', category: 'vendas', description: '', amount: 0 });

  const loadEntries = () => {
    apiFetch('/finance')
      .then((res) => res.json())
      .then((json) => setEntries(json.data || []));
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await apiFetch('/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ type: 'income', category: 'vendas', description: '', amount: 0 });
    loadEntries();
  };

  return (
    <>
      <header className="page-header">
        <h1>Financeiro</h1>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Lançamento</button>
      </header>

      <div className="card">
        <h3>Registrar movimentação</h3>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label>Tipo</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>
          <div className="field">
            <label>Categoria</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Descrição</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Valor</label>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit">Salvar</button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td><span className={`badge ${entry.type === 'income' ? 'success' : 'danger'}`}>{entry.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
                <td>{entry.category}</td>
                <td>{entry.description}</td>
                <td>R$ {Number(entry.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
