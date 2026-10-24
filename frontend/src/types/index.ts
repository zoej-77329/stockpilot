export type Role = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  product_count: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string;
  category_name: string | null;
  unit_price: string;
  cost_price: string;
  current_stock: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  movement_type: 'RECEIPT' | 'ADJUSTMENT' | 'ORDER_DEDUCT' | 'ORDER_RESTOCK';
  quantity_delta: number;
  reference_type: string;
  reference_id: string;
  unit_cost: string | null;
  notes: string | null;
  created_by: string;
  created_by_username: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  item_count: number;
  created_by: string;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface StockReceiptItem {
  id: string;
  stock_receipt_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_cost: string;
  total_cost: string;
}

export interface StockReceipt {
  id: string;
  receipt_number: string;
  supplier_id: string;
  supplier_name: string | null;
  total_cost: string;
  notes: string | null;
  received_by: string;
  received_by_username: string | null;
  received_at: string;
  items: StockReceiptItem[];
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  reason: string;
  quantity_delta: number;
  previous_stock: number;
  new_stock: number;
  notes: string | null;
  adjusted_by: string;
  adjusted_by_username: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_inventory_value: string;
  total_active_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_orders: number;
  total_revenue: string;
  low_stock_items: Product[];
  recent_movements: StockMovement[];
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    sku?: string;
    available?: number;
    requested?: number;
  };
}
