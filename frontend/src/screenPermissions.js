export const screenOptions = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'clients', label: 'Clientes', path: '/clientes' },
  { key: 'projects', label: 'Obras', path: '/obras' },
  { key: 'subdivisions', label: 'Loteamentos', path: '/loteamentos' },
  { key: 'tasks', label: 'Tarefas', path: '/tarefas' },
  { key: 'schedule', label: 'Cronograma', path: '/cronograma' },
  { key: 'materials', label: 'Materiais', path: '/materiais' },
  { key: 'suppliers', label: 'Fornecedores', path: '/fornecedores' },
  { key: 'maps', label: 'Mapa', path: '/mapa' },
  { key: 'concrete', label: 'Concretagem', path: '/concretagem' },
  { key: 'finance', label: 'Financeiro', path: '/financeiro' },
];

export function canAccessScreen(user, screen) {
  return user?.role === 'admin' || user?.screen_permissions?.includes(screen) === true;
}
