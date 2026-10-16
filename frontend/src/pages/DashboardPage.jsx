import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    apiFetch('/dashboard')
      .then((res) => res.json())
      .then((json) => setSummary(json.data))
      .catch(() => setSummary({ cards: [], projectStatus: [], revenue: [] }));
  }, []);

  if (!summary) {
    return <div className="card">Carregando dashboard...</div>;
  }

  const exportReport = () => {
    const rows = [
      ['Indicador', 'Valor'],
      ...summary.cards.map((card) => [card.label, card.value]),
      ['Status das obras', 'Quantidade'],
      ...summary.projectStatus.map((item) => [item.status, item.count]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';'))
      .join('\r\n');
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'traceobra-dashboard.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" type="button" onClick={exportReport}>Relatório CSV</button>
          <button className="primary-btn" type="button" onClick={() => navigate('/obras')}>Nova obra</button>
        </div>
      </header>

      <section className="stats-grid">
        {summary.cards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="meta">
              <span>{card.label}</span>
              <span className={`badge ${card.tone === 'green' ? 'success' : card.tone === 'amber' ? 'warning' : card.tone === 'purple' ? 'success' : ''}`}>
                {card.tone}
              </span>
            </div>
            <p className="value">{card.value}</p>
            <div className="trend">+12.4% vs. mês anterior</div>
          </div>
        ))}
      </section>

      <section className="panel-grid">
        <div className="card">
          <h2>Status das obras</h2>
          <div className="list">
            {summary.projectStatus.length ? summary.projectStatus.map((item) => (
              <div key={item.status} className="list-item">
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </div>
            )) : <p>Nenhum dado disponível</p>}
          </div>
        </div>

        <div className="card">
          <h3>Receita</h3>
          <div className="kpis">
            {summary.revenue.length ? summary.revenue.map((item) => (
              <div key={item.month} className="kpi">
                <strong>R$ {Number(item.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                <span>{item.month}</span>
              </div>
            )) : <p>Sem movimentação</p>}
          </div>
        </div>
      </section>
    </>
  );
}
