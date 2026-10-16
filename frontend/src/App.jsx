import { Routes, Route } from 'react-router-dom';
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
import { getStoredUser } from './auth';

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

  return (
    <Layout user={user} onLogout={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/obras" element={<ProjectsPage />} />
        <Route path="/loteamentos" element={<SubdivisionsPage />} />
        <Route path="/tarefas" element={<TasksPage />} />
        <Route path="/cronograma" element={<SchedulePage />} />
        <Route path="/materiais" element={<MaterialsPage />} />
        <Route path="/fornecedores" element={<SuppliersPage />} />
        <Route path="/financeiro" element={<FinancePage />} />
        <Route path="/mapa" element={<MapsPage />} />
        <Route path="/concretagem" element={<ConcretePage />} />
      </Routes>
    </Layout>
  );
}
