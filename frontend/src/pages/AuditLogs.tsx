import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AuditLog } from '../types';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params: any = { page, per_page: 25 };
      if (actionFilter) params.action = actionFilter;
      const res = await api.getAuditLogs(params);
      setLogs(res.data as AuditLog[]);
      if (res.meta) setTotalPages(res.meta.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [actionFilter]);
  useEffect(() => { load(); }, [page, actionFilter]);

  const actionColor = (action: string) => {
    if (action.includes('LOGIN')) return 'bg-blue-100 text-blue-800';
    if (action.includes('CREATE') || action.includes('REGISTER')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE') || action.includes('ADJUST') || action.includes('STATUS')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('DELETE') || action.includes('CANCEL')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <input
          className="input w-56"
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        />
      </div>

      {error && <div className="bg-red-50 border border-red-300 rounded p-3 mb-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">No audit events found.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{l.username || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor(l.action)}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {l.entity_type && <span className="font-medium">{l.entity_type}</span>}
                      {l.entity_id && <span className="text-xs text-gray-400 ml-1 font-mono">{l.entity_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400 max-w-xs truncate font-mono">
                      {l.details ? JSON.stringify(l.details) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">{l.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="flex items-center text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
