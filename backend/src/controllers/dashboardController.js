const { pool } = require('../config/db');

async function getSummary(req, res) {
  try {
    const [metrics, projectStatus, revenue] = await Promise.all([
      pool.query(`
        SELECT
            (SELECT COUNT(*) FROM clients WHERE company_id = $1) AS clients,
            (SELECT COUNT(*) FROM projects WHERE company_id = $1) AS projects,
            (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.company_id = $1) AS tasks,
            (SELECT COALESCE(SUM(amount), 0) FROM financial_entries WHERE company_id = $1 AND type = 'income') AS income,
            (SELECT COALESCE(SUM(amount), 0) FROM financial_entries WHERE company_id = $1 AND type = 'expense') AS expense;
          `, [req.user.company_id]),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM projects
        WHERE company_id = $1
        GROUP BY status;
      `, [req.user.company_id]),
      pool.query(`
        SELECT
          TO_CHAR(entry_date, 'YYYY-MM') AS month,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
        FROM financial_entries
        WHERE company_id = $1
        GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 6;
      `, [req.user.company_id])
    ]);

    const summary = metrics.rows[0];

    res.json({
      ok: true,
      data: {
        cards: [
          { label: 'Clientes', value: Number(summary.clients || 0), tone: 'blue' },
          { label: 'Obras', value: Number(summary.projects || 0), tone: 'green' },
          { label: 'Tarefas', value: Number(summary.tasks || 0), tone: 'amber' },
          { label: 'Receita líquida', value: `R$ ${Number((Number(summary.income || 0) - Number(summary.expense || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, tone: 'purple' },
        ],
        projectStatus: projectStatus.rows,
        revenue: revenue.rows
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Erro ao buscar resumo', error: error.message });
  }
}

module.exports = { getSummary };
