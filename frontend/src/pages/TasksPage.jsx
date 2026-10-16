import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { focusFirstFormField } from '../uiActions';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ project_id: '', title: '', description: '', status: 'pending', priority: 'medium' });

  const loadTasks = () => {
    apiFetch('/tasks')
      .then((res) => res.json())
      .then((json) => setTasks(json.data || []));
  };

  useEffect(() => {
    loadTasks();
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
    await apiFetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm((current) => ({ project_id: current.project_id, title: '', description: '', status: 'pending', priority: 'medium' }));
    loadTasks();
  };

  return (
    <>
      <header className="page-header">
        <h1>Tarefas</h1>
        <button className="primary-btn" type="button" onClick={focusFirstFormField}>+ Nova tarefa</button>
      </header>

      <div className="card">
        <h3>Registrar tarefa</h3>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label>Obra</label>
            <select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Selecione uma obra</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Título</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Prioridade</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Descrição</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">Pendente</option>
              <option value="in_progress">Em execução</option>
              <option value="done">Concluída</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button className="primary-btn" type="submit">Salvar tarefa</button>
          </div>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Projeto</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td><span className={`badge ${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success'}`}>{task.priority}</span></td>
                <td>{task.status}</td>
                <td>{task.project_name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
