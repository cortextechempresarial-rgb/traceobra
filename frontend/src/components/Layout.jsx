import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  Fence,
  CheckSquare,
  CalendarRange,
  Package,
  Truck,
  Wallet,
  LogOut,
  Building2,
  Map,
  ClipboardCheck,
  Shield,
} from 'lucide-react';
import { logout } from '../auth';
import { canAccessScreen, screenOptions } from '../screenPermissions';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Clientes', path: '/clientes', icon: Users },
  { label: 'Obras', path: '/obras', icon: BriefcaseBusiness },
  { label: 'Loteamentos', path: '/loteamentos', icon: Fence },
  { label: 'Tarefas', path: '/tarefas', icon: CheckSquare },
  { label: 'Cronograma', path: '/cronograma', icon: CalendarRange },
  { label: 'Materiais', path: '/materiais', icon: Package },
  { label: 'Fornecedores', path: '/fornecedores', icon: Truck },
  { label: 'Mapa', path: '/mapa', icon: Map },
  { label: 'Concretagem', path: '/concretagem', icon: ClipboardCheck },
  { label: 'Financeiro', path: '/financeiro', icon: Wallet },
];

export default function Layout({ children, user, onLogout }) {
  const visibleItems = user?.role === 'super_admin'
    ? [{ label: 'Empresas', path: '/admin/empresas', icon: Shield }]
    : [
      ...navItems.filter((item) => {
        const screen = screenOptions.find((option) => option.path === item.path)?.key;
        return screen && canAccessScreen(user, screen);
      }),
      ...(user?.role === 'admin' ? [{ label: 'Usuários', path: '/admin/usuarios', icon: Users }] : []),
    ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Building2 size={22} /></div>
          <div>
            <strong>TraceObra</strong>
            <span>{user?.role || 'ERP'}</span>
          </div>
        </div>

        <nav className="nav">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="user-box">
          <span>{user?.name || 'Usuário'}</span>
        </div>

        <button className="logout-btn" onClick={() => { onLogout?.(); logout(); }}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <main className="main-panel">{children}</main>
    </div>
  );
}
