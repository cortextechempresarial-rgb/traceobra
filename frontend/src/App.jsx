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
import { canAccessScreen } from './screenPermissions';
import CompanyUsersPage from './pages/CompanyUsersPage';

function ProtectedScreen({ user, screen, children }) {
  return canAccessScreen(user, screen)
    ? children
    : <div className="card"><h2>Acesso não permitido</h2><p>Seu administrador não liberou esta tela para sua conta.</p></div>;
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    const handleStorage = () => setUser(getStoredUser());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  if (user.role === 'super_admin') {
    return (
      <Layout user={user} onLogout={() => setUser(null)}>
        <Routes>
          <Route path="/admin/empresas" element={<CompaniesPage />} />
          <Route path="*" element={<Navigate to="/admin/empresas" replace />} />
        </Routes>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={() => setUser(null)}>
      <Routes>
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
          element={user.role === 'admin'
            ? <CompanyUsersPage currentUser={user} />
            : <div className="card"><h2>Acesso não permitido</h2></div>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
