import { useEffect, useState } from 'react';
import { apiFetch, readApiResponse } from '../api';
import MaterialUsageFields from '../components/MaterialUsageFields';
import { focusFirstFormField } from '../uiActions';

const emptyMaterialUsage = () => [{ material_id: '', quantity: '1' }];
const initialForm = () => ({
  name: '',
  client_id: '',
  subdivision_id: '',
  status: 'planning',
  progress: 0,
  budget: 0,
  activity_description: '',
  materials_used: emptyMaterialUsage(),
});

function ProjectChangeForm({ project, clients, subdivisions, materials, onSave }) {
  const [form, setForm] = useState({
    name: project.name,
    client_id: project.client_id || '',
    subdivision_id: project.subdivision_id || '',
    status: project.status || 'planning',
    progress: Number(project.progress || 0),
    budget: Number(project.budget || 0),
    activity_description: '',
    materials_used: emptyMaterialUsage(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: project.name,
      client_id: project.client_id || '',
      subdivision_id: project.subdivision_id || '',
      status: project.status || 'planning',
      progress: Number(project.progress || 0),
      budget: Number(project.budget || 0),
    }));
  }, [project]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(project.id, {
        ...form,
        name: form.name.trim(),
        client_id: form.client_id || null,
      });
      setForm((current) => ({ ...current, activity_description: '', materials_used: emptyMaterialUsage() }));
      setHistory(null);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível salvar as alterações da obra.');
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    setError('');
    try {
      const response = await apiFetch(`/projects/${project.id}/activities`);
      const result = await readApiResponse(response, 'Não foi possível carregar o histórico.');
      setHistory(result.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível carregar o histórico.');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="project-details">
      <form onSubmit={submit} className="form-grid project-change-form">
        <label className="field">Nome da obra
          <input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field">Loteamento
          <select required value={form.subdivision_id} onChange={(event) => setForm({ ...form, subdivision_id: event.target.value })}>
            <option value="">Selecione o loteamento</option>
            {subdivisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field">Cliente
          <select value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })}>
            <option value="">Sem cliente vinculado</option>
            {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="field">Status
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="planning">Planejamento</option>
            <option value="in_progress">Em progresso</option>
            <option value="completed">Concluída</option>
          </select>
        </label>
        <label className="field">Progresso (%)
          <input required type="number" min="0" max="100" step="1" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} />
        </label>
        <label className="field">Orçamento
          <input required type="number" min="0" step="0.01" value={form.budget} onChange={(event) => setForm({ ...form, budget: Number(event.target.value) })} />
        </label>
        <label className="field full-width">Alteração / serviço executado
          <textarea required rows={3} value={form.activity_description} onChange={(event) => setForm({ ...form, activity_description: event.target.value })} placeholder="Descreva a alteração e o serviço realizado nesta obra" />
        </label>
        <div className="full-width">
          <MaterialUsageFields
            materials={materials}
            value={form.materials_used}
            onChange={(materialsUsed) => setForm({ ...form, materials_used: materialsUsed })}
          />
        </div>
        <div className="full-width">
          <button className="primary-btn" type="submit" disabled={saving || !materials.length}>
            {saving ? 'Salvando alteração...' : 'Salvar alteração e dar baixa nos materiais'}
          </button>
        </div>
      </form>
      <button className="secondary-btn" type="button" disabled={loadingHistory} onClick={loadHistory}>
        {loadingHistory ? 'Carregando histórico...' : 'Ver histórico de materiais'}
      </button>
      {error && <div className="form-message error" role="alert">{error}</div>}
      {history && (
        <div className="project-activity-history">
          {history.map((activity) => (
            <article key={activity.id}>
              <strong>{activity.activity_type === 'creation' ? 'Cadastro da obra' : 'Alteração'} · {new Date(activity.created_at).toLocaleString('pt-BR')}</strong>
              <p>{activity.description}</p>
              <ul>
                {activity.materials.map((item) => (
                  <li key={`${activity.id}-${item.material_id}`}>
                    {item.material_name}: {Number(item.quantity).toLocaleString('pt-BR')} {item.unit} · R$ {Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por unidade
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {!history.length && <p>Nenhuma alteração registrada.</p>}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [subdivisions, setSubdivisions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProjects = () => apiFetch('/projects')
    .then((response) => readApiResponse(response, 'Não foi possível carregar as obras.'))
    .then((result) => setProjects(result.data || []))
    .catch((requestError) => setError(requestError.message));

  useEffect(() => {
    loadProjects();
    apiFetch('/clients')
      .then((response) => readApiResponse(response, 'Não foi possível carregar os clientes.'))
      .then((result) => setClients(result.data || []))
      .catch((requestError) => setError(requestError.message));
    apiFetch('/subdivisions')
      .then((response) => readApiResponse(response, 'Não foi possível carregar os loteamentos.'))
      .then((result) => setSubdivisions(result.data || []))
      .catch((requestError) => setError(requestError.message));
    apiFetch('/materials')
      .then((response) => readApiResponse(response, 'Não foi possível carregar os materiais.'))
      .then((result) => setMaterials(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await apiFetch('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          client_id: form.client_id || null,
        }),
      });
      const result = await readApiResponse(response, 'Não foi possível cadastrar a obra.');
      setProjects((current) => [{
        ...result.data,
        client_name: clients.find((item) => item.id === result.data.client_id)?.name || '',
        subdivision_name: subdivisions.find((item) => item.id === result.data.subdivision_id)?.name || '',
      }, ...current]);
      setForm(initialForm());
      setSuccess('Obra cadastrada e materiais iniciais registrados no estoque e no histórico.');
      try {
        const stockResponse = await apiFetch('/materials');
        const stockResult = await readApiResponse(stockResponse, 'Não foi possível atualizar o estoque.');
        setMaterials(stockResult.data || []);
      } catch (stockError) {
        setError(`Obra salva, mas não foi possível atualizar a lista de estoque: ${stockError.message}`);
      }
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível cadastrar a obra.');
    } finally {
      setSaving(false);
    }
  };

  const updateProject = async (projectId, changes) => {
    setError('');
    const response = await apiFetch(`/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const result = await readApiResponse(response, 'Não foi possível salvar a alteração.');
    setProjects((current) => current.map((project) => (
      project.id === projectId
        ? {
          ...project,
          ...result.data,
          subdivision_name: subdivisions.find((item) => item.id === result.data.subdivision_id)?.name || '',
        }
        : project
    )));
    setSuccess('Alteração registrada e materiais baixados do estoque.');
    try {
      const stockResponse = await apiFetch('/materials');
      const stockResult = await readApiResponse(stockResponse, 'Não foi possível atualizar o estoque.');
      setMaterials(stockResult.data || []);
    } catch (stockError) {
      setError(`Alteração salva, mas não foi possível atualizar a lista de estoque: ${stockError.message}`);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Obras</h1>
          <p>Cadastre a obra dentro de um loteamento e acompanhe cada alteração e material utilizado.</p>
        </div>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Nova obra</button>
      </header>

      <div className="card">
        <h2>Cadastrar obra</h2>
        <form onSubmit={submit} className="form-grid">
          <label className="field">Nome da obra
            <input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">Loteamento
            <select required value={form.subdivision_id} onChange={(event) => setForm({ ...form, subdivision_id: event.target.value })}>
              <option value="">Selecione o loteamento</option>
              {subdivisions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {!subdivisions.length && <small>Cadastre um loteamento na tela Loteamentos antes de criar uma obra.</small>}
          </label>
          <label className="field">Cliente
            <select value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })}>
              <option value="">Sem cliente vinculado</option>
              {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="field">Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="planning">Planejamento</option>
              <option value="in_progress">Em progresso</option>
              <option value="completed">Concluída</option>
            </select>
          </label>
          <label className="field">Progresso (%)
            <input type="number" min="0" max="100" step="1" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} />
          </label>
          <label className="field">Orçamento
            <input type="number" min="0" step="0.01" value={form.budget} onChange={(event) => setForm({ ...form, budget: Number(event.target.value) })} />
          </label>
          <label className="field full-width">Serviço inicial / descrição da obra
            <textarea required rows={3} value={form.activity_description} onChange={(event) => setForm({ ...form, activity_description: event.target.value })} placeholder="Descreva o serviço inicial executado na obra" />
          </label>
          <div className="full-width">
            <MaterialUsageFields
              materials={materials}
              value={form.materials_used}
              onChange={(materialsUsed) => setForm({ ...form, materials_used: materialsUsed })}
            />
          </div>
          <div className="full-width">
            <button className="primary-btn" type="submit" disabled={saving || !subdivisions.length || !materials.length}>
              {saving ? 'Salvando obra...' : 'Cadastrar obra e registrar materiais'}
            </button>
          </div>
        </form>
        {error && <div className="form-message error" role="alert">{error}</div>}
        {success && <div className="form-message" role="status">{success}</div>}
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr><th>Obra</th><th>Loteamento</th><th>Cliente</th><th>Status</th><th>Progresso</th><th>Orçamento</th><th>Alterações e materiais</th></tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                clients={clients}
                subdivisions={subdivisions}
                materials={materials}
                onSave={updateProject}
              />
            ))}
            {!projects.length && <tr><td colSpan="7">Nenhuma obra cadastrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProjectRow({ project, clients, subdivisions, materials, onSave }) {
  return (
    <>
      <tr>
        <td>{project.name}</td>
        <td>{project.subdivision_name || '—'}</td>
        <td>{project.client_name || '—'}</td>
        <td><span className={`badge ${project.status === 'completed' ? 'success' : project.status === 'in_progress' ? 'warning' : ''}`}>{project.status}</span></td>
        <td>{project.progress}%</td>
        <td>R$ {Number(project.budget || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td><details><summary>Editar / registrar uso</summary>
          <ProjectChangeForm project={project} clients={clients} subdivisions={subdivisions} materials={materials} onSave={onSave} />
        </details></td>
      </tr>
    </>
  );
}
