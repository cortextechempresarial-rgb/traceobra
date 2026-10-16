import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function SchedulePage() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    phase: 'implantação',
    status: 'planejado',
    progress: 0,
    start_date: '',
    end_date: '',
    owner: 'Equipe',
    notes: '',
  });

  const loadSchedule = () => {
    apiFetch('/schedule')
      .then((res) => res.json())
      .then((json) => setItems(json.data || []));
  };

  useEffect(() => {
    loadSchedule();
    apiFetch('/projects')
      .then((res) => res.json())
      .then((json) => {
        const availableProjects = json.data || [];
        setProjects(availableProjects);
        setForm((current) => ({ ...current, project_id: current.project_id || availableProjects[0]?.id || '' }));
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await apiFetch('/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({
      project_id: form.project_id,
      title: '',
      phase: 'implantação',
      status: 'planejado',
      progress: 0,
      start_date: '',
      end_date: '',
      owner: 'Equipe',
      notes: '',
    });
    loadSchedule();
  };

  return (
    <>
      <header className="page-header">
        <h1>Cronograma da obra</h1>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Nova atividade</button>
      </header>

      <div className="card">
        <h3>Planejamento de execução</h3>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label>Obra</label>
            <select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Selecione uma obra</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Atividade</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Estrutura em concreto" />
          </div>
          <div className="field">
            <label>Fase</label>
            <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
              <option value="implantação">Implantação</option>
              <option value="estrutura">Estrutura</option>
              <option value="acabamento">Acabamento</option>
              <option value="comissionamento">Comissionamento</option>
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="planejado">Planejado</option>
              <option value="em andamento">Em andamento</option>
              <option value="atrasado">Atrasado</option>
              <option value="concluído">Concluído</option>
            </select>
          </div>
          <div className="field">
            <label>Progresso (%)</label>
            <input type="number" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Início</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="field">
            <label>Fim</label>
            <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div className="field">
            <label>Responsável</label>
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Observações</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit">Salvar atividade</button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Atividade</th>
              <th>Fase</th>
              <th>Status</th>
              <th>Progresso</th>
              <th>Responsável</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.phase}</td>
                <td><span className={`badge ${item.status === 'concluído' ? 'success' : item.status === 'atrasado' ? 'danger' : 'warning'}`}>{item.status}</span></td>
                <td>{item.progress}%</td>
                <td>{item.owner}</td>
                <td>{item.start_date ? `${item.start_date} → ${item.end_date || ''}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
