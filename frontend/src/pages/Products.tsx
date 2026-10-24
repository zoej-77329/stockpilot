import React, { useEffect, useState } from 'react';
import { Product, Category } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitPrice, setUnitPrice] = useState('0.00');
  const [costPrice, setCostPrice] = useState('0.00');
  const [initialStock, setInitialStock] = useState('0');
  const [threshold, setThreshold] = useState('10');

  const { isAdmin } = useAuth();
  const fetchCategories = async () => {
    try {
      const { data } = await api.getCategories();
      setCategories(data);
    } catch {
      // ignore
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, meta } = await api.getProducts({
        page,
        per_page: 10,
        search: search.trim() || undefined,
        category_id: selectedCategory || undefined,
        low_stock: lowStockOnly || undefined,
      });
      setProducts(data);
      if (meta) {
        setTotalPages(meta.total_pages || 1);
        setTotalItems(meta.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, selectedCategory, lowStockOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setActiveProductId(null);
    setSku('');
    setName('');
    setDescription('');
    setCategoryId(categories[0]?.id || '');
    setUnitPrice('29.99');
    setCostPrice('15.00');
    setInitialStock('25');
    setThreshold('10');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setModalMode('edit');
    setActiveProductId(p.id);
    setSku(p.sku);
    setName(p.name);
    setDescription(p.description || '');
    setCategoryId(p.category_id);
    setUnitPrice(p.unit_price);
    setCostPrice(p.cost_price);
    setInitialStock(p.current_stock.toString());
    setThreshold(p.low_stock_threshold.toString());
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (modalMode === 'create') {
        await api.createProduct({
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          category_id: categoryId,
          unit_price: unitPrice,
          cost_price: costPrice,
          initial_stock: parseInt(initialStock) || 0,
          low_stock_threshold: parseInt(threshold) || 10,
        });
      } else if (activeProductId) {
        await api.updateProduct(activeProductId, {
          name: name.trim(),
          description: description.trim() || undefined,
          category_id: categoryId,
          unit_price: unitPrice,
          cost_price: costPrice,
          low_stock_threshold: parseInt(threshold) || 10,
        });
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('Submission failed. Check backend connectivity.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Catalog & Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage product SKUs, pricing, stock levels, and safety thresholds.</p>
        </div>

        {isAdmin() && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md transition-all self-start sm:self-auto"
          >
            + Add New Product
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU or product name..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="font-semibold text-amber-700">Low Stock Only</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs text-left">
              <tr>
                <th className="px-6 py-3.5">SKU</th>
                <th className="px-6 py-3.5">Product Title</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5 text-right">Selling Price</th>
                <th className="px-6 py-3.5 text-right">Cost</th>
                <th className="px-6 py-3.5 text-center">Stock Level</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                {isAdmin() && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin() ? 8 : 7} className="py-12 text-center text-slate-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{p.sku}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      {p.description && <div className="text-xs text-slate-400 line-clamp-1">{p.description}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium">
                        {p.category_name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      ${Number(p.unit_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      ${Number(p.cost_price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`font-mono font-extrabold ${
                          p.current_stock === 0
                            ? 'text-rose-600'
                            : p.is_low_stock
                            ? 'text-amber-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {p.current_stock}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/ min {p.low_stock_threshold}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          p.current_stock === 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : p.is_low_stock
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {p.current_stock === 0 ? 'Out of Stock' : p.is_low_stock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    {isAdmin() && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin() ? 8 : 7} className="py-12 text-center text-slate-400">
                    No products found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold">{products.length}</span> of <span className="font-semibold">{totalItems}</span> products
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-600 flex items-center px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
      <Modal
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Add New Catalog Product' : 'Edit Product'}
      >
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {formError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SKU Code *</label>
              <input
                type="text"
                required
                disabled={modalMode === 'edit'}
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. ELEC-001"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500 uppercase disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Product Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Commercial name of product"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specifications or details..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cost Price ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {modalMode === 'create' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
            )}
            <div className={modalMode === 'edit' ? 'col-span-2' : ''}>
              <label className="block text-xs font-bold text-slate-700 mb-1">Low-Stock Alert Threshold</label>
              <input
                type="number"
                min="0"
                required
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow"
            >
              {submitting ? 'Saving...' : modalMode === 'create' ? 'Create Product' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
      )}
    </div>
  );
}
