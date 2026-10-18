import { Navigate, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProjectsPage from './pages/ProjectsPage';
import TasksPage from './pages/TasksPage';
import FinancePage from './pages/FinancePage';
import MaterialsPage from './pages/MaterialsPage';
import SuppliersPage from './pages/SuppliersPage';
import SchedulePage from './pages/SchedulePage';
import MapsPage from './pages/MapsPage';
import SubdivisionsPage from './pages/SubdivisionsPage';
import ConcretePage from './pages/ConcretePage';
import LoginPage from './pages/LoginPage';
import CompaniesPage from './pages/CompaniesPage';
import { getStoredUser } from './auth';
import { apiFetch, readApiResponse } from './api';
import { canAccessScreen } from './screenPermissions';
import CompanyUsersPage from './pages/CompanyUsersPage';

function ProtectedScreen({ user, screen, children }) {
  return canAccessScreen(user, screen)
    ? children
    : <div className="card"><h2>Acesso não permitido</h2><p>Seu administrador não liberou esta tela para sua conta.</p></div>;
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    user?.role === 'super_admin' ? localStorage.getItem('traceobra_company_id') || '' : ''
  );

  useEffect(() => {
    const handleStorage = () => setUser(getStoredUser());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setCompanies([]);
      setSelectedCompanyId('');
      localStorage.removeItem('traceobra_company_id');
      return undefined;
    }
    let cancelled = false;
    apiFetch('/admin/companies')
      .then((response) => readApiResponse(response, 'Não foi possível carregar as empresas.'))
      .then((result) => {
        if (cancelled) return;
        const nextCompanies = result.data || [];
        const activeCompanies = nextCompanies.filter((company) => company.status === 'active');
        const savedCompanyId = localStorage.getItem('traceobra_company_id') || '';
        const nextCompanyId = activeCompanies.some((company) => company.id === savedCompanyId)
          ? savedCompanyId
          : '';
        setCompanies(nextCompanies);
        setSelectedCompanyId(nextCompanyId);
        if (nextCompanyId) localStorage.setItem('traceobra_company_id', nextCompanyId);
        else localStorage.removeItem('traceobra_company_id');
      })
      .catch((error) => {
        if (!cancelled) console.error('Falha ao carregar empresas do super admin:', error.message);
      });
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    if (selectedCompanyId) localStorage.setItem('traceobra_company_id', selectedCompanyId);
    else localStorage.removeItem('traceobra_company_id');
  }, [selectedCompanyId, user?.role]);

  useEffect(() => {
    if (user?.role !== 'super_admin' || !selectedCompanyId) return;
    const activeCompany = companies.some((company) => (
      company.id === selectedCompanyId && company.status === 'active'
    ));
    if (!activeCompany) setSelectedCompanyId('');
  }, [companies, selectedCompanyId, user?.role]);

  const selectCompany = (companyId) => {
    if (companyId) localStorage.setItem('traceobra_company_id', companyId);
    else localStorage.removeItem('traceobra_company_id');
    setSelectedCompanyId(companyId);
  };

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const isSuperAdmin = user.role === 'super_admin';
  const selectedCompanyIsActive = companies.some((company) => (
    company.id === selectedCompanyId && company.status === 'active'
  ));
  const companyContextReady = !isSuperAdmin || selectedCompanyIsActive;

  return (
    <Layout
      key={isSuperAdmin ? selectedCompanyId || 'global' : user.id}
      user={user}
      onLogout={() => setUser(null)}
      companies={companies}
      selectedCompanyId={selectedCompanyId}
      onCompanySelect={selectCompany}
    >
      <Routes>
        {isSuperAdmin && <Route path="/admin/empresas" element={<CompaniesPage onCompaniesChange={setCompanies} />} />}
        {!companyContextReady && <Route path="*" element={<Navigate to="/admin/empresas" replace />} />}
        {companyContextReady && (
          <>
        <Route path="/" element={<ProtectedScreen user={user} screen="dashboard"><DashboardPage /></ProtectedScreen>} />
        <Route path="/clientes" element={<ProtectedScreen user={user} screen="clients"><ClientsPage /></ProtectedScreen>} />
        <Route path="/obras" element={<ProtectedScreen user={user} screen="projects"><ProjectsPage /></ProtectedScreen>} />
        <Route path="/loteamentos" element={<ProtectedScreen user={user} screen="subdivisions"><SubdivisionsPage /></ProtectedScreen>} />
        <Route path="/tarefas" element={<ProtectedScreen user={user} screen="tasks"><TasksPage /></ProtectedScreen>} />
        <Route path="/cronograma" element={<ProtectedScreen user={user} screen="schedule"><SchedulePage /></ProtectedScreen>} />
        <Route path="/materiais" element={<ProtectedScreen user={user} screen="materials"><MaterialsPage /></ProtectedScreen>} />
        <Route path="/fornecedores" element={<ProtectedScreen user={user} screen="suppliers"><SuppliersPage /></ProtectedScreen>} />
        <Route path="/financeiro" element={<ProtectedScreen user={user} screen="finance"><FinancePage /></ProtectedScreen>} />
        <Route path="/mapa" element={<ProtectedScreen user={user} screen="maps"><MapsPage /></ProtectedScreen>} />
        <Route path="/concretagem" element={<ProtectedScreen user={user} screen="concrete"><ConcretePage /></ProtectedScreen>} />
        <Route
          path="/admin/usuarios"
          element={user.role === 'admin' || (isSuperAdmin && selectedCompanyIsActive)
            ? <CompanyUsersPage currentUser={user} />
            : <div className="card"><h2>Acesso não permitido</h2></div>}
        />
          </>
        )}
        {!isSuperAdmin && <Route path="/admin/empresas" element={<Navigate to="/" replace />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
