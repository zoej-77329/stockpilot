import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Order, Customer, Product } from '../types';
import Modal from '../components/Modal';
import { ApiError } from '../api/client';

interface OrderLineItem {
  product_id: string;
  quantity: string;
  unit_price: string;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'PENDING' ? 'badge-pending' :
    status === 'CONFIRMED' ? 'badge-confirmed' :
    'badge-cancelled';
  return <span className={cls}>{status}</span>;
}

function OrderForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ customer_id: '', tax_rate: '0.00' });
  const [items, setItems] = useState<OrderLineItem[]>([{ product_id: '', quantity: '1', unit_price: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCustomers().then(r => setCustomers(r.data as Customer[])).catch(() => {});
    api.getProducts({ per_page: 200 }).then(r => setProducts(r.data as Product[])).catch(() => {});
  }, []);

  const addLine = () => setItems(i => [...i, { product_id: '', quantity: '1', unit_price: '' }]);
  const removeLine = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));
  const updateLine = (idx: number, field: keyof OrderLineItem, value: string) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [field]: value } : item));

  // Auto-fill unit price when product selected
  const handleProductChange = (idx: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    setItems(i => i.map((item, j) => j === idx
      ? { ...item, product_id: productId, unit_price: product ? product.unit_price : '' }
      : item
    ));
  };

  const subtotal = items.reduce((sum, item) => {
    const qty = parseInt(item.quantity || '0');
    const price = parseFloat(item.unit_price || '0');
    return sum + qty * price;
  }, 0);
  const taxRate = parseFloat(form.tax_rate || '0') / 100;
  const total = subtotal + subtotal * taxRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id) { setError('Please select a customer.'); return; }
    for (const item of items) {
      if (!item.product_id) { setError('All line items must have a product selected.'); return; }
      if (!item.quantity || parseInt(item.quantity) < 1) { setError('Quantity must be at least 1.'); return; }
      if (!item.unit_price || parseFloat(item.unit_price) < 0) { setError('Unit price must be non-negative.'); return; }
    }
    setLoading(true); setError('');
    try {
      await api.createOrder({
        customer_id: form.customer_id,
        tax_rate: form.tax_rate,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: parseInt(i.quantity),
          unit_price: i.unit_price,
        })),
      });
      onSuccess();
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        setError(`Insufficient stock for ${err.sku}: requested ${err.requested}, available ${err.available}.`);
      } else {
        setError(err.message || 'Failed to create order.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Customer *</label>
          <select className="input" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tax Rate (%)</label>
          <input className="input" type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Order Items *</label>
          <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={addLine}>+ Add Item</button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => {
            const product = products.find(p => p.id === item.product_id);
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <select className="input" value={item.product_id} onChange={e => handleProductChange(idx, e.target.value)}>
                    <option value="">Select product…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} disabled={p.current_stock === 0}>
                        {p.name} ({p.sku}) — Stock: {p.current_stock}
                      </option>
                    ))}
                  </select>
                  {product && product.is_low_stock && (
                    <p className="text-xs text-orange-600 mt-0.5">⚠ Low stock</p>
                  )}
                </div>
                <div className="col-span-2">
                  <input className="input" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-3">
                  <input className="input" type="number" step="0.01" min="0" placeholder="Unit price" value={item.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                </div>
                <div className="col-span-2 flex justify-end items-center">
                  <span className="text-sm text-gray-600 mr-2 font-mono">
                    \${((parseInt(item.quantity || '0')) * parseFloat(item.unit_price || '0')).toFixed(2)}
                  </span>
                  {items.length > 1 && (
                    <button type="button" className="btn-danger text-xs py-1 px-2" onClick={() => removeLine(idx)}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t pt-3 text-sm text-right space-y-1">
        <div className="text-gray-600">Subtotal: <span className="font-mono font-medium">\${subtotal.toFixed(2)}</span></div>
        <div className="text-gray-600">Tax ({form.tax_rate}%): <span className="font-mono font-medium">\${(subtotal * taxRate).toFixed(2)}</span></div>
        <div className="text-gray-900 font-bold text-base">Total: <span className="font-mono">\${total.toFixed(2)}</span></div>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Placing Order…' : 'Place Order'}</button>
      </div>
    </form>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params: any = { page, per_page: 15 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.getOrders(params);
      setOrders(res.data as Order[]);
      if (res.meta) setTotalPages(res.meta.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [statusFilter]);
  useEffect(() => { load(); }, [page, statusFilter]);

  const handleCancel = async (order: Order) => {
    if (!confirm(`Cancel order ${order.order_number}? This will restock all items.`)) return;
    setCancellingId(order.id);
    try {
      await api.cancelOrder(order.id, 'Cancelled by user');
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex gap-3">
          <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Order</button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-300 rounded p-3 mb-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">{statusFilter ? 'No orders with this status.' : 'No orders yet.'}</p>
          {!statusFilter && <p className="text-sm mt-1">Click "New Order" to place your first order.</p>}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map(o => (
                  <React.Fragment key={o.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600">{o.order_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{o.customer_name || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={o.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{o.item_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">\${parseFloat(o.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                        {o.status !== 'CANCELLED' && (
                          <button
                            className="btn-danger text-xs py-1 px-2"
                            disabled={cancellingId === o.id}
                            onClick={() => handleCancel(o)}
                          >
                            {cancellingId === o.id ? '…' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === o.id && o.items && (
                      <tr>
                        <td colSpan={7} className="px-6 py-3 bg-gray-50">
                          <table className="min-w-full text-sm">
                            <thead><tr className="text-gray-500">
                              <th className="text-left py-1 pr-4">Product</th>
                              <th className="text-right py-1 pr-4">Qty</th>
                              <th className="text-right py-1 pr-4">Unit Price</th>
                              <th className="text-right py-1">Total</th>
                            </tr></thead>
                            <tbody>
                              {o.items.map(item => (
                                <tr key={item.id}>
                                  <td className="py-1 pr-4">{item.product_name} <span className="text-gray-400">({item.product_sku})</span></td>
                                  <td className="py-1 pr-4 text-right font-mono">{item.quantity}</td>
                                  <td className="py-1 pr-4 text-right font-mono">\${parseFloat(item.unit_price).toFixed(2)}</td>
                                  <td className="py-1 text-right font-mono">\${parseFloat(item.total_price).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-2 text-xs text-gray-500 text-right space-y-0.5">
                            <div>Subtotal: \${parseFloat(o.subtotal).toFixed(2)}</div>
                            <div>Tax: \${parseFloat(o.tax_amount).toFixed(2)}</div>
                            <div className="font-bold text-gray-900">Total: \${parseFloat(o.total_amount).toFixed(2)}</div>
                          </div>
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
        <Modal title="New Order" onClose={() => setShowCreate(false)} wide>
          <OrderForm onSuccess={() => { setShowCreate(false); load(); }} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  );
}
