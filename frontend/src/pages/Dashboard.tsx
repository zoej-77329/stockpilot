import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardStats } from '../types';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const money = (v: string | number | undefined) =>
  Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tone = 'indigo' | 'violet' | 'amber' | 'emerald';
const TONES: Record<Tone, { bubble: string; ring: string }> = {
  indigo: { bubble: 'bg-indigo-50 text-indigo-600', ring: 'ring-indigo-100' },
  violet: { bubble: 'bg-violet-50 text-violet-600', ring: 'ring-violet-100' },
  amber: { bubble: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100' },
  emerald: { bubble: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100' },
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Kpi(props: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  tone: Tone;
  icon: string;
  loading: boolean;
  alert?: boolean;
  testId: string;
  children?: ReactNode;
}) {
  const t = TONES[props.tone];
  return (
    <div
      data-testid={props.testId}
      className={`card card-hover p-5 ${props.alert ? 'border-amber-200 bg-gradient-to-br from-amber-50/70 to-white' : ''}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{props.label}</p>
        <span className={`grid place-items-center h-9 w-9 rounded-xl ring-1 ${t.bubble} ${t.ring}`}>
          <Icon d={props.icon} />
        </span>
      </div>
      {props.loading ? (
        <div className="skeleton h-8 w-28 mt-3" />
      ) : (
        <p className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">{props.value}</p>
      )}
      <div className="text-xs text-slate-500 mt-1.5">{props.hint}</div>
      {props.children}
    </div>
  );
}

const MOVEMENT_STYLE = (type: string) =>
  type === 'RECEIPT' || type === 'ORDER_RESTOCK'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : type === 'ORDER_DEDUCT'
    ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const skeleton = loading && !stats;
  const total = stats?.total_active_products || 0;
  const low = stats?.low_stock_count || 0;
  const healthyPct = total > 0 ? Math.max(0, Math.round(((total - low) / total) * 100)) : 100;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{today}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            {greeting}{user?.username ? `, ${user.username}` : ''}
          </h1>
          <p className="page-sub">Executive Inventory Dashboard &mdash; real-time stock valuation, order throughput, and alerts.</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={fetchStats} disabled={loading} className="btn-secondary" data-testid="refresh-dashboard">
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <Link to="/orders" className="btn-primary" data-testid="create-order">
            + Create Order
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 ring-1 ring-inset ring-rose-200 text-rose-800 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Kpi
          testId="kpi-stock-value"
          label="Total Stock Value"
          tone="indigo"
          icon="M12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5 1.3 2.5 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5"
          loading={skeleton}
          value={<>${money(stats?.total_inventory_value)}</>}
          hint="Asset cost valuation"
        />
        <Kpi
          testId="kpi-catalog"
          label="Catalog Size"
          tone="violet"
          icon="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8"
          loading={skeleton}
          value={total}
          hint="Active SKUs monitored"
        >
          {!skeleton && total > 0 && (
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: `${healthyPct}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">{healthyPct}% of SKUs above safety threshold</p>
            </div>
          )}
        </Kpi>
        <Kpi
          testId="kpi-low-stock"
          label="Low Stock Breaches"
          tone="amber"
          alert={low > 0}
          icon="M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
          loading={skeleton}
          value={low}
          hint={<>{stats?.out_of_stock_count || 0} completely out-of-stock</>}
        />
        <Kpi
          testId="kpi-orders"
          label="Total Orders & Sales"
          tone="emerald"
          icon="M5 7h14l-1.5 9h-11L5 7zm0 0L4 4H2m6 15a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"
          loading={skeleton}
          value={stats?.total_orders || 0}
          hint={<span className="font-semibold text-emerald-600">${money(stats?.total_revenue)} confirmed</span>}
        />
      </div>

      {/* Low stock alert */}
      {stats && stats.low_stock_items && stats.low_stock_items.length > 0 && (
        <section className="rounded-2xl p-6 bg-gradient-to-br from-amber-50 to-orange-50/40 ring-1 ring-inset ring-amber-200 shadow-soft" data-testid="low-stock-panel">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-amber-950">Immediate Reorder Required</h2>
              <p className="text-xs text-amber-800/80 mt-0.5">The following products have breached their safety threshold.</p>
            </div>
            <Link
              to="/receipts"
              className="inline-flex items-center justify-center text-xs font-bold bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98]"
            >
              Receive Stock
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl bg-white/70 ring-1 ring-inset ring-amber-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-amber-800 bg-amber-100/50">
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Product Name</th>
                  <th className="px-4 py-2.5">Current Stock</th>
                  <th className="px-4 py-2.5">Threshold</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {stats.low_stock_items.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-50/80">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-900">{item.sku}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-2.5 font-bold text-rose-600">{item.current_stock} units</td>
                    <td className="px-4 py-2.5 text-slate-600">{item.low_stock_threshold} units</td>
                    <td className="px-4 py-2.5">
                      <span className="badge bg-rose-50 text-rose-700 ring-rose-200 text-[10px] uppercase tracking-wide">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {item.current_stock === 0 ? 'Out of stock' : 'Low stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section className="card p-0 overflow-hidden" data-testid="recent-activity">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Recent Inventory Movement Activity</h2>
          <Link to="/movements" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            View Full Ledger &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-500 text-left">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">SKU &amp; Product</th>
                <th className="px-6 py-3 text-right">Delta</th>
                <th className="px-6 py-3">Authorized By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.recent_movements && stats.recent_movements.length > 0 ? (
                stats.recent_movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3 text-xs text-slate-500 font-mono">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span className={`badge text-[10px] uppercase tracking-wider ${MOVEMENT_STYLE(m.movement_type)}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{m.product_name}</div>
                      <div className="text-xs font-mono text-slate-400">{m.product_sku}</div>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold">
                      <span className={m.quantity_delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600">{m.created_by_username || 'System'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-slate-400">
                    {skeleton ? 'Loading activity…' : 'No recent inventory transactions logged yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
