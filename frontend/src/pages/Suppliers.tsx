import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Supplier } from '../types';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

function SupplierForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Supplier name is required.'); return; }
    setLoading(true); setError('');
    try {
      await api.createSupplier({
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier.');
    } finally {
      setLoading(false);
    }
  };

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">{error}</div>}
      <div>
        <label className="label">Supplier Name *</label>
        <input className="input" placeholder="e.g. Acme Corp" {...f('name')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Contact Name</label>
          <input className="input" placeholder="John Smith" {...f('contact_name')} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" placeholder="+1 555-0100" {...f('phone')} />
        </div>
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" placeholder="supplier@example.com" {...f('email')} />
      </div>
      <div>
        <label className="label">Address</label>
        <textarea className="input" rows={2} placeholder="123 Main St, City" {...f('address')} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Create Supplier'}</button>
      </div>
    </form>
  );
}

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params: any = {};
      if (search) params.search = search;
      const res = await api.getSuppliers(params);
      setSuppliers(res.data as Supplier[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        {isAdmin() && <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Supplier</button>}
      </div>

      <div className="mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search suppliers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="bg-red-50 border border-red-300 rounded p-3 mb-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : suppliers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-lg">{search ? 'No suppliers match your search.' : 'No suppliers yet.'}</p>
          {isAdmin() && !search && <p className="text-sm mt-1">Click "New Supplier" to add one.</p>}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.contact_name || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.email || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.phone || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="New Supplier" onClose={() => setShowCreate(false)}>
          <SupplierForm onSuccess={() => { setShowCreate(false); load(); }} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  );
}
