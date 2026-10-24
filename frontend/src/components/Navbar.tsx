import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      api.getDashboardStats()
        .then(({ data }) => setLowStockCount(data.low_stock_count || 0))
        .catch(() => {});
    }
  }, [user, location.pathname]);

  // Close the mobile menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'Categories', path: '/categories' },
    { name: 'Suppliers', path: '/suppliers' },
    { name: 'Customers', path: '/customers' },
    { name: 'Receipts', path: '/receipts' },
    { name: 'Adjustments', path: '/adjustments' },
    { name: 'Movements', path: '/movements' },
    { name: 'Orders', path: '/orders' },
    ...(isAdmin() ? [{ name: 'Audit Logs', path: '/audit-logs' }] : []),
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const initial = (user?.username || '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl text-white border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 shrink-0" data-testid="nav-brand">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 text-sm font-black tracking-wider shadow-glow">
              SP
            </span>
            <span className="text-lg font-extrabold tracking-tight">StockPilot</span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden xl:flex items-center gap-1" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                data-testid={`nav-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive(link.path)
                    ? 'bg-white/10 text-white ring-1 ring-inset ring-white/15'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {lowStockCount > 0 && (
              <Link
                to="/products"
                className="hidden sm:flex items-center gap-2 bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/30 px-3 py-1 rounded-full text-xs font-semibold hover:bg-amber-500/25 transition-all"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>{lowStockCount} Low Stock</span>
              </Link>
            )}

            <div className="flex items-center gap-3 sm:border-l sm:border-white/10 sm:pl-4">
              <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-white/15 text-sm font-bold">
                {initial}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-sm font-semibold text-slate-100">{user?.username}</div>
                <span
                  className={`inline-block text-[10px] uppercase font-bold tracking-wider ${
                    user?.role === 'admin' ? 'text-indigo-300' : 'text-emerald-300'
                  }`}
                >
                  {user?.role}
                </span>
              </div>
              <button
                onClick={logout}
                data-testid="logout-button"
                className="bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 text-slate-300 ring-1 ring-inset ring-white/10 hover:ring-rose-400/40 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              >
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              data-testid="nav-menu-button"
              className="xl:hidden grid place-items-center h-9 w-9 rounded-lg bg-white/5 ring-1 ring-inset ring-white/10 text-slate-200 hover:bg-white/10 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / tablet navigation panel */}
      {menuOpen && (
        <nav className="xl:hidden border-t border-white/10 bg-slate-950/95" aria-label="Mobile">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.path)
                    ? 'bg-white/10 text-white ring-1 ring-inset ring-white/15'
                    : 'text-slate-300 bg-white/[0.03] hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
