import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { StockMovement } from '../types';

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Receipt',
  ADJUSTMENT: 'Adjustment',
  ORDER_DEDUCT: 'Order Deduction',
  ORDER_RESTOCK: 'Order Restock',
};

export default function Movements() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params: any = { page, per_page: 20 };
      if (typeFilter) params.movement_type = typeFilter;
      const res = await api.getMovements(params);
      setMovements(res.data as StockMovement[]);
      if (res.meta) setTotalPages(res.meta.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load movements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [typeFilter]);
  useEffect(() => { load(); }, [page, typeFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Movement Ledger</h1>
        <select
          className="input w-48"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="RECEIPT">Receipt</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="ORDER_DEDUCT">Order Deduction</option>
          <option value="ORDER_RESTOCK">Order Restock</option>
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-300 rounded p-3 mb-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : movements.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">No movements found.</p>
          <p className="text-sm mt-1">Stock movements are recorded automatically when receipts, adjustments, and orders are processed.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Delta</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        m.movement_type === 'RECEIPT' ? 'bg-green-100 text-green-800' :
                        m.movement_type === 'ORDER_DEDUCT' ? 'bg-red-100 text-red-800' :
                        m.movement_type === 'ORDER_RESTOCK' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {m.product_name || '—'}
                      {m.product_sku && <span className="ml-1 text-gray-400 text-xs">({m.product_sku})</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                      <span className={m.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                        {m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">{m.reference_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.created_by_username || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{m.notes || '—'}</td>
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
