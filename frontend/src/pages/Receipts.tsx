import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { StockReceipt, Supplier, Product } from '../types';
import Modal from '../components/Modal';

interface ReceiptLineItem {
  product_id: string;
  quantity: string;
  unit_cost: string;
}

function ReceiptForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ supplier_id: '', notes: '' });
  const [items, setItems] = useState<ReceiptLineItem[]>([{ product_id: '', quantity: '1', unit_cost: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getSuppliers().then(r => setSuppliers(r.data as Supplier[])).catch(() => {});
    api.getProducts({ per_page: 200 }).then(r => setProducts(r.data as Product[])).catch(() => {});
  }, []);

  const addLine = () => setItems(i => [...i, { product_id: '', quantity: '1', unit_cost: '' }]);
  const removeLine = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));
  const updateLine = (idx: number, field: keyof ReceiptLineItem, value: string) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id) { setError('Please select a supplier.'); return; }
    for (const item of items) {
      if (!item.product_id) { setError('All line items must have a product selected.'); return; }
      if (!item.quantity || parseInt(item.quantity) < 1) { setError('Quantity must be at least 1.'); return; }
      if (!item.unit_cost || parseFloat(item.unit_cost) <= 0) { setError('Unit cost must be greater than 0.'); return; }
    }
    setLoading(true); setError('');
    try {
      await api.createReceipt({
        supplier_id: form.supplier_id,
        notes: form.notes.trim() || null,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity),
          unit_cost: i.unit_cost,
        })),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create stock receipt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="label">Supplier *</label>
        <select className="input" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
          <option value="">Select supplier…</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Line Items *</label>
          <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={addLine}>+ Add Item</button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <select className="input" value={item.product_id} onChange={e => updateLine(idx, 'product_id', e.target.value)}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <input className="input" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
              </div>
              <div className="col-span-3">
                <input className="input" type="number" step="0.01" min="0.01" placeholder="Unit cost" value={item.unit_cost} onChange={e => updateLine(idx, 'unit_cost', e.target.value)} />
              </div>
              <div className="col-span-2 flex justify-end">
                {items.length > 1 && (
                  <button type="button" className="btn-danger text-xs py-1 px-2" onClick={() => removeLine(idx)}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Record Receipt'}</button>
      </div>
    </form>
  );
}

export default function Receipts() {
  const [receipts, setReceipts] = useState<StockReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.getReceipts({ page, per_page: 15 });
      setReceipts(res.data as StockReceipt[]);
      if (res.meta) setTotalPages(res.meta.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load receipts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Receipts</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Receipt</button>
      </div>

      {error && <div className="bg-red-50 border border-red-300 rounded p-3 mb-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : receipts.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">No stock receipts yet.</p>
          <p className="text-sm mt-1">Click "New Receipt" to record incoming stock from a supplier.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {receipts.map(r => (
                  <React.Fragment key={r.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-indigo-600">{r.receipt_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.supplier_name || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">\${parseFloat(r.total_cost).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.received_by_username || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(r.received_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{expandedId === r.id ? '▲' : '▼'}</td>
                    </tr>
                    {expandedId === r.id && r.items && (
                      <tr>
                        <td colSpan={6} className="px-6 py-3 bg-gray-50">
                          <table className="min-w-full text-sm">
                            <thead><tr className="text-gray-500">
                              <th className="text-left py-1 pr-4">Product</th>
                              <th className="text-right py-1 pr-4">Qty</th>
                              <th className="text-right py-1 pr-4">Unit Cost</th>
                              <th className="text-right py-1">Total</th>
                            </tr></thead>
                            <tbody>
                              {r.items.map(item => (
                                <tr key={item.id}>
                                  <td className="py-1 pr-4">{item.product_name} <span className="text-gray-400">({item.product_sku})</span></td>
                                  <td className="py-1 pr-4 text-right font-mono">{item.quantity}</td>
                                  <td className="py-1 pr-4 text-right font-mono">\${parseFloat(item.unit_cost).toFixed(2)}</td>
                                  <td className="py-1 text-right font-mono">\${parseFloat(item.total_cost).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {r.notes && <p className="mt-2 text-xs text-gray-500 italic">Notes: {r.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
        <Modal title="New Stock Receipt" onClose={() => setShowCreate(false)} wide>
          <ReceiptForm onSuccess={() => { setShowCreate(false); load(); }} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  );
}
