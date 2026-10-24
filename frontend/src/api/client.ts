import { ApiResponse } from '../types';

const BASE_URL = '/api';

export class ApiError extends Error {
  code: string;
  sku?: string;
  available?: number;
  requested?: number;

  constructor(message: string, code: string = 'ERROR', sku?: string, available?: number, requested?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.sku = sku;
    this.available = available;
    this.requested = requested;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; meta?: any }> {
  const token = localStorage.getItem('stockpilot_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const body: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    data: null as any,
    error: { code: 'INVALID_JSON', message: 'Invalid response from server.' },
  }));

  if (!response.ok || !body.success) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('stockpilot_token');
      localStorage.removeItem('stockpilot_user');
      window.location.href = '/login';
    }

    const err = body.error || { code: 'UNKNOWN_ERROR', message: response.statusText || 'Request failed' };
    throw new ApiError(err.message, err.code, err.sku, err.available, err.requested);
  }

  return { data: body.data, meta: body.meta };
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<any>('/auth/me'),
  logout: () =>
    request('/auth/logout', { method: 'POST' }).finally(() => {
      localStorage.removeItem('stockpilot_token');
      localStorage.removeItem('stockpilot_user');
    }),

  // Products
  getProducts: (params: { page?: number; per_page?: number; search?: string; category_id?: string; low_stock?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.per_page) query.set('per_page', params.per_page.toString());
    if (params.search) query.set('search', params.search);
    if (params.category_id) query.set('category_id', params.category_id);
    if (params.low_stock) query.set('low_stock', 'true');
    return request<any[]>(`/products?${query.toString()}`);
  },
  getProduct: (id: string) => request<any>(`/products/${id}`),
  createProduct: (data: any) => request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: any) => request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<any>(`/products/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request<any[]>('/categories'),
  createCategory: (data: any) => request<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  // Suppliers & Customers
  getSuppliers: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/suppliers?${q}`);
  },
  createSupplier: (data: any) => request<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  getCustomers: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/customers?${q}`);
  },
  createCustomer: (data: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),

  // Stock Receipts & Adjustments
  getReceipts: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/stock/receipts?${q}`);
  },
  createReceipt: (data: any) => request<any>('/stock/receipts', { method: 'POST', body: JSON.stringify(data) }),
  getAdjustments: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/stock/adjustments?${q}`);
  },
  createAdjustment: (data: any) => request<any>('/stock/adjustments', { method: 'POST', body: JSON.stringify(data) }),
  getMovements: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/stock/movements?${q}`);
  },

  // Orders
  getOrders: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/orders?${q}`);
  },
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  createOrder: (data: any) => request<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  cancelOrder: (id: string, reason: string) =>
    request<any>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'CANCELLED', reason }) }),

  // Dashboard & Audit
  getDashboardStats: () => request<any>('/dashboard/stats'),
  getAuditLogs: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<any[]>(`/audit-logs?${q}`);
  },
  getHealth: () => fetch('/api/health').then((r) => r.json()),
};
