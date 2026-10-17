import { useEffect, useState } from 'react';
import { apiFetch, readApiResponse } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function MaterialsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'concreto', stock: 0, unit: 'un.', unit_price: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMaterials = () => {
    apiFetch('/materials')
      .then((response) => readApiResponse(response, 'Não foi possível carregar os materiais.'))
      .then((result) => setItems(result.data || []))
      .catch((requestError) => setError(requestError.message));
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiFetch('/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      await readApiResponse(response, 'Não foi possível cadastrar o material.');
      setForm({ name: '', category: 'concreto', stock: 0, unit: 'un.', unit_price: 0 });
      setSuccess('Material cadastrado.');
      loadMaterials();
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível cadastrar o material.');
    } finally {
      setSaving(false);
    }
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
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Concreto usinado" />
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
            <input required type="number" min="0" step="0.001" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Unidade</label>
            <input required maxLength={30} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Ex.: kg, m³, saco, un." />
          </div>
          <div className="field">
            <label>Preço unitário</label>
            <input required type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar material'}</button>
          </div>
        </form>
        {error && <div className="form-message error" role="alert">{error}</div>}
        {success && <div className="form-message" role="status">{success}</div>}
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
                <td>{Number(item.stock).toLocaleString('pt-BR')} {item.unit || 'un.'}</td>
                <td>R$ {Number(item.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
