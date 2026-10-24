import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { StockAdjustment, Product } from '../types';
import Modal from '../components/Modal';

function AdjustmentForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ product_id: '', quantity_delta: '', reason: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getProducts({ per_page: 200 }).then(r => setProducts(r.data as Product[])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) { setError('Please select a product.'); return; }
    if (!form.quantity_delta || form.quantity_delta === '0') { setError('Quantity delta cannot be zero.'); return; }
    if (!form.reason.trim()) { setError('Reason is required.'); return; }
    setLoading(true); setError('');
    try {
      await api.createAdjustment({
        product_id: form.product_id,
        quantity_delta: parseInt(form.quantity_delta),
        reason: form.reason.trim(),
        notes: form.notes.trim() || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create adjustment.');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === form.product_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="label">Product *</label>
        <select className="input" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
          <option value="">Select product…</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {p.current_stock}</option>
          ))}
        </select>
        {selectedProduct && (
          <p className="mt-1 text-xs text-gray-500">Current stock: <strong>{selectedProduct.current_stock}</strong> units</p>
        )}
      </div>

      <div>
        <label className="label">Quantity Delta * (use negative to reduce stock)</label>
        <input
          className="input"
          type="number"
          placeholder="e.g. -5 or +10"
          value={form.quantity_delta}
          onChange={e => setForm(f => ({ ...f, quantity_delta: e.target.value }))}
        />
        {form.quantity_delta && selectedProduct && (
          <p className="mt-1 text-xs text-gray-500">
            New stock will be: <strong>{selectedProduct.current_stock + parseInt(form.quantity_delta || '0')}</strong>
          </p>
        )}
      </div>

      <div>
        <label className="label">Reason *</label>
        <select className="input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
          <option value="">Select reason…</option>
          <option value="DAMAGE">Damage</option>
          <option value="THEFT">Theft</option>
          <option value="EXPIRY">Expiry</option>
          <option value="COUNT_CORRECTION">Stock Count Correction</option>
          <option value="RETURN">Customer Return</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} placeholder="Additional details…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Record Adjustment'}</button>
      </div>
    </form>
  );
}

export default function Adjustments() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.getAdjustments({ page, per_page: 15 });
      setAdjustments(res.data as StockAdjustment[]);
      if (res.meta) setTotalPages(res.meta.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load adjustments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Adjustments</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Adjustment</button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 rounded p-3 mb-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : adjustments.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">No stock adjustments yet.</p>
          <p className="text-sm mt-1">Use adjustments to correct stock discrepancies, record damage, theft, or expiry.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adj #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Delta</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Previous</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">New Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adjustments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600">{a.adjustment_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {a.product_name}
                      {a.product_sku && <span className="ml-1 text-gray-400 text-xs">({a.product_sku})</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                      <span className={a.quantity_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                        {a.quantity_delta > 0 ? '+' : ''}{a.quantity_delta}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-500">{a.previous_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">{a.new_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.adjusted_by_username || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(a.created_at).toLocaleDateString()}</td>
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

      {showCreate && (
        <Modal title="New Stock Adjustment" onClose={() => setShowCreate(false)}>
          <AdjustmentForm onSuccess={() => { setShowCreate(false); load(); }} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  );
}
