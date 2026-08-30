import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell.jsx';
import { OrderStatusNotifications } from './components/OrderStatusNotifications.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.jsx';
import { CategoriesPage } from './pages/admin/CategoriesPage.jsx';
import { EmployeesPage } from './pages/admin/EmployeesPage.jsx';
import { MenuItemsPage } from './pages/admin/MenuItemsPage.jsx';
import { InventoryPage } from './pages/admin/InventoryPage.jsx';
import { ReportsPage } from './pages/admin/ReportsPage.jsx';
import { TablesPage } from './pages/admin/TablesPage.jsx';
import { CashierOrderPage } from './pages/cashier/CashierOrderPage.jsx';
import { KitchenQueuePage } from './pages/kitchen/KitchenQueuePage.jsx';
import { OrderHistoryPage } from './pages/orders/OrderHistoryPage.jsx';
import { api, getStoredToken, storeToken } from './services/api.js';

const defaultPageForRole = (role) => {
  if (role === 'admin') return 'dashboard';
  if (role === 'cashier') return 'order';
  return 'queue';
};

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getStoredToken()));
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    if (!getStoredToken()) return;
    api.me().then((sessionUser) => {
      setUser(sessionUser);
      setActivePage(defaultPageForRole(sessionUser.role));
    }).catch(() => storeToken(null)).finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) return <div className="app-loading"><span className="brand-mark brand-mark--large">L</span><p>Restoring your local session…</p></div>;
  if (!user) return <LoginPage onLogin={(loggedInUser) => { setUser(loggedInUser); setActivePage(defaultPageForRole(loggedInUser.role)); }} />;

  const logout = async () => {
    try { await api.logout(); } catch { /* Clear local access even if the server stopped. */ }
    storeToken(null); setUser(null); setActivePage('dashboard');
  };

  let page = null;
  if (user.role === 'admin') {
    const adminPages = {
      dashboard: <AdminDashboard user={user} onNavigate={setActivePage} />,
      employees: <EmployeesPage currentUser={user} />,
      categories: <CategoriesPage />,
      menu: <MenuItemsPage />,
      tables: <TablesPage />,
      orders: <OrderHistoryPage />,
      inventory: <InventoryPage />,
      reports: <ReportsPage />,
    };
    page = adminPages[activePage] ?? adminPages.dashboard;
  } else if (user.role === 'cashier') {
    const cashierPages = {
      order: <CashierOrderPage onViewHistory={() => setActivePage('history')} />,
      history: <OrderHistoryPage onNewOrder={() => setActivePage('order')} />,
    };
    page = cashierPages[activePage] ?? cashierPages.order;
  } else if (user.role === 'kitchen') {
    page = <KitchenQueuePage />;
  }

  return (
    <>
      <AppShell user={user} activePage={activePage} onNavigate={setActivePage} onLogout={logout}>{page}</AppShell>
      {user.role === 'cashier' && <OrderStatusNotifications />}
    </>
  );
}

export default App;
