import { useEffect, useState } from 'react';

type State = 'checking' | 'ok' | 'down';

/** Live system status: polls /api/health every 30 s (shows backend + database connectivity). */
export default function StatusPill() {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const body = await res.json();
        const healthy = res.ok && body.status === 'healthy' && body.database === 'connected';
        if (alive) setState(healthy ? 'ok' : 'down');
      } catch {
        if (alive) setState('down');
      }
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const tone =
    state === 'ok'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : state === 'down'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : 'bg-slate-100 text-slate-500 ring-slate-200';
  const dot = state === 'ok' ? 'bg-emerald-500' : state === 'down' ? 'bg-rose-500' : 'bg-slate-400';
  const label = state === 'ok' ? 'All systems operational' : state === 'down' ? 'Service unavailable' : 'Checking status…';

  return (
    <span data-testid="status-pill" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${dot} ${state === 'ok' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}
