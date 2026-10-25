/** IDs returned by the API are UUID strings. */
export type UUID = string;
export type UserRole = 'OWNER' | 'RECEPTIONIST';

export interface Category {
  id: UUID;
  name: string;
}

export interface Product {
  id: UUID;
  name: string;
  sku?: string;
  description?: string;
  size?: string;
  color?: string;
  price: number;
  cost: number;
  stockQuantity: number;
  active: boolean;
  category?: Category | null;
}

export interface Customer {
  id: UUID;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface SaleItem {
  id: UUID;
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: UUID;
  saleNumber: string;
  saleDate: string;
  customer?: Customer | null;
  paymentMethod: string;
  totalAmount: number;
  items?: SaleItem[];
}

export interface DashboardSummary {
  todayRevenue: number;
  todaySalesCount: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
  recentSales: Sale[];
}

export interface AppUser {
  id: UUID;
  name: string;
  email: string;
  role: UserRole;
  workspaceTheme: 'forest' | 'ocean' | 'berry' | 'clay';
  createdAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number | string;
}

export interface ProductRequest {
  name: string;
  sku: string;
  description: string;
  size: string;
  color: string;
  price: number;
  cost: number;
  stockQuantity: number;
  active: boolean;
  category: { id: UUID } | null;
}

export interface SaleRequest {
  customerId: UUID | null;
  paymentMethod: string;
  items: Array<{ productId: UUID; quantity: number; unitPrice: number }>;
}
