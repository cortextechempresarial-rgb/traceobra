import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function MaterialsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'concreto', stock: 0, unit_price: 0 });

  const loadMaterials = () => {
    apiFetch('/materials')
      .then((res) => res.json())
      .then((json) => setItems(json.data || []));
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await apiFetch('/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', category: 'concreto', stock: 0, unit_price: 0 });
    loadMaterials();
  };

  return (
    <>
      <header className="page-header">
        <h1>Materiais</h1>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Novo material</button>
      </header>

      <div className="card">
        <h3>Cadastro de insumos</h3>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Concreto usinado" />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="concreto">Concreto</option>
              <option value="estrutura">Estrutura</option>
              <option value="acabamento">Acabamento</option>
              <option value="hidraulica">Hidráulica</option>
              <option value="eletrica">Elétrica</option>
            </select>
          </div>
          <div className="field">
            <label>Estoque</label>
            <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Preço unitário</label>
            <input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit">Salvar material</button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoria</th>
              <th>Estoque</th>
              <th>Preço unitário</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.stock}</td>
                <td>R$ {Number(item.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
