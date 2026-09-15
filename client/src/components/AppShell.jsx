const adminNavigation = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'employees', label: 'Employees', icon: 'users' },
  { id: 'categories', label: 'Categories', icon: 'tag' },
  { id: 'menu', label: 'Menu items', icon: 'menu' },
  { id: 'tables', label: 'Tables', icon: 'table' },
  { id: 'inventory', label: 'Inventory', icon: 'inventory' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'orders', label: 'Order history', icon: 'receipt' },
];

const cashierNavigation = [
  { id: 'order', label: 'New order', icon: 'order' },
  { id: 'history', label: 'Order history', icon: 'receipt' },
];

const roleLabels = {
  admin: 'Administrator',
  cashier: 'Cashier',
  kitchen: 'Kitchen staff',
};

function NavIcon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    tag: <><path d="M20.59 13.41 11 3.83V3H4v7h.83l9.58 9.59a2 2 0 0 0 2.82 0l3.36-3.36a2 2 0 0 0 0-2.82Z" /><circle cx="7.5" cy="6.5" r="1" /></>,
    menu: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="7" cy="5" r="1" /><circle cx="7" cy="12" r="1" /><circle cx="7" cy="19" r="1" /></>,
    table: <><path d="M3 7h18M5 7v13M19 7v13M3 4h18v3H3zM9 7v13M15 7v13" /></>,
    order: <><path d="M3 3h18v5H3zM5 8v13h14V8M9 12h6M9 16h6" /></>,
    receipt: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2zM9 7h6M9 11h6M9 15h4" /></>,
    kitchen: <><path d="M4 14h16M6 14a6 6 0 0 1 12 0M12 8V5M9 5h6M3 18h18" /></>,
    inventory: <><path d="M4 7h16v13H4zM3 4h18v3H3zM8 11h8M8 15h5" /></>,
    reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function AppShell({ user, activePage, onNavigate, onLogout, children }) {
  const navigation = user.role === 'admin'
    ? adminNavigation
    : user.role === 'cashier'
      ? cashierNavigation
      : [{ id: 'queue', label: 'Kitchen queue', icon: 'kitchen' }];
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">L</span>
          <div><strong>Leslie&apos;s</strong><small>Restaurant system</small></div>
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activePage === item.id ? 'nav-item nav-item--active' : 'nav-item'}
              onClick={() => onNavigate(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="offline-dot" />
          <div><strong>Local system</strong><small>Offline ready</small></div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-header">
          <div>
            <p>{roleLabels[user.role]} workspace</p>
            <h1>{navigation.find((item) => item.id === activePage)?.label ?? 'Dashboard'}</h1>
          </div>
          <div className="user-actions">
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-meta"><strong>{user.name}</strong><span>@{user.username}</span></div>
            <button className="logout-button" type="button" onClick={onLogout}>
              <NavIcon name="logout" />
              <span>Log out</span>
            </button>
          </div>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
