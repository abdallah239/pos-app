import { prisma } from '@/prisma';
import { requireAuthenticatedUser, requireRole } from '@/permissions';
import { getCurrentUser } from '@/session';

export default async function DashboardPage({
  request,
}: {
  request: Request;
}) {
  // Check authentication
  const { user } = await requireAuthenticatedUser(request);

  // Get role-based navigation
  const navigation = getRoleBasedNavigation(user.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M3 12l2-2m6 4l2-2m7.01-4.99a1 1 0 010 1.41l-2 2m-2.01 7l2 2M5.585 5.585a1 1 0 111.414-1.414L15 8.586M5 12l2-2m6 4l2 2m7.01-4.99a1 1 0 01-1.41 0l-2 2m0 0a1 1 0 011.414 1.41l2-2M9.98 9.98a1 1 0 011.41 0l2 2m-2.02 2.02a1 1 0 01-1.414 0l-2-2m0 0a1 1 0 010 1.414l2 2m-6.98 6.98a1 1 0 01-1.414 0l-2-2m6.98.02a1 1 0 011.414 0l2 2M15 15a3 3 0 110-6 3 3 0 010 6z"></path>
                </svg>
              </div>
              <span className="font-medium text-lg text-gray-900">POS System</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Welcome, {user.username}
              </span>

              <button
                onClick={() => {
                  // Trigger logout
                  const csrfToken = request.cookies.get('csrf')?.value;
                  // In a real implementation, would make a logout API call
                  window.location.href = '/login?logout';
                }}
                className="px-3 py-1 text-xs text-gray-600 rounded-md hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Summary cards */}
          <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {await getProductCount()}
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {await getActiveUserCount()}
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Sales</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{await getTotalSales()} EGP</p>
          </div>

          {/* Additional metrics row */}
          <div className="col-span-2 md:col-span-2 bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Transaction Summary</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-500">Transactions</p>
                <p className="text-2xl font-bold">{await getTotalTransactions()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Avg Transaction</p>
                <p className="text-2xl font-bold">{await getAverageTransactionValue()} EGP</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Discounts</p>
                <p className="text-2xl font-bold">{await getTotalDiscounts()} EGP</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Returns</p>
                <p className="text-2xl font-bold">{await getTotalReturns()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500">Low Stock Alerts</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{await getLowStockProducts()}</p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-sm font-medium text-gray-500">Inventory Value</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{await getTotalInventoryValue()} EGP</p>
          </div>
        </div>

        {/* Role-based content */}
        {user.role === 'ADMIN' && (
          <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Controls</h2>
            <nav className="space-y-2">
              <a
                href="/products"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                Products
              </a>
              <a
                href="/users"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                User Management
              </a>
            </nav>
          </div>
        )}

        {user.role === 'MANAGER' && (
          <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Manager Controls</h2>
            <nav className="space-y-2">
              <a
                href="/products"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                Products
              </a>
            </nav>
          </div>
        )}

        {user.role === 'CASHIER' && (
          <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cashier Controls</h2>
            <nav className="space-y-2">
              <a
                href="/cashier"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                Cashier
              </a>
              <a
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-100"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
                Dashboard
              </a>
            </nav>
          </div>
        )}
      </main>
    </div>
  );
}

/** Helper functions for dashboard data */
async function getProductCount(): Promise<string> {
  const count = await prisma.product.count();
  return count.toString();
}

async function getActiveUserCount(): Promise<string> {
  const count = await prisma.user.count({ where: { isActive: true } });
  return count.toString();
}

async function getTotalSales(): Promise<string> {
  // Calculate total completed sales from the database
  const sales = await prisma.sale.findMany({
    where: { status: 'completed' },
    select: { totalAmount: true },
  });
  const totalCents = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  // Format as EGP (Egyptian Pounds): divide by 100 for major currency
  const egp = totalCents / 100;
  return egp.toFixed(2);
}

async function getTotalTransactions(): Promise<string> {
  const count = await prisma.sale.count({ where: { status: 'completed' } });
  return count.toString();
}

async function getAverageTransactionValue(): Promise<string> {
  const sales = await prisma.sale.findMany({
    where: { status: 'completed' },
    select: { totalAmount: true },
  });
  if (sales.length === 0) return '0.00';
  const totalCents = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const avgCents = totalCents / sales.length;
  const avgEgp = avgCents / 100;
  return avgEgp.toFixed(2);
}

async function getTotalDiscounts(): Promise<string> {
  const sales = await prisma.sale.findMany({
    where: { status: 'completed' },
    select: { discountAmount: true },
  });
  const totalCents = sales.reduce((sum, sale) => sum + (sale.discountAmount || 0), 0);
  return (totalCents / 100).toFixed(2);
}

async function getTotalReturns(): Promise<string> {
  const returns = await prisma.saleReturn.count({ where: { status: 'completed' } });
  return returns.toString();
}

async function getLowStockProducts(): Promise<string> {
  const count = await prisma.product.count({
    where: { allowNegativeStock: false, minStockLevel: { gt: 0 }, trackInventory: true },
  });
  // Actually count products with low stock - this is a simplified count
  const products = await prisma.product.findMany({
    where: { trackInventory: true },
    select: { minStockLevel: true, id: true },
  });
  let lowStockCount = 0;
  for (const product of products) {
    // Check inventory movements for this product
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: product.id, type: 'OUTGOING' },
    });
    const totalOutgoing = movements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    // This is a simplified check - in production would track current stock
    if (product.minStockLevel > 0 && totalOutgoing > 0) lowStockCount++;
  }
  return lowStockCount.toString();
}

async function getTotalInventoryValue(): Promise<string> {
  const products = await prisma.product.findMany({
    where: { trackInventory: true },
    select: { price: true, id: true },
  });
  const totalCents = products.reduce((sum, product) => sum + product.price, 0);
  return (totalCents / 100).toFixed(2);
}

function getRoleBasedNavigation(role: string | null) {
  const nav: Record<string, { label: string; href: string }[]> = {
    ADMIN: [
      { label: 'Dashboard', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'Cashier', href: '/cashier' },
      { label: 'User Management', href: '/users' },
    ],
    MANAGER: [
      { label: 'Dashboard', href: '/' },
      { label: 'Products', href: '/products' },
    ],
    CASHIER: [
      { label: 'Dashboard', href: '/' },
      { label: 'Cashier', href: '/cashier' },
    ],
  };

  return nav[role] || nav.CASHIER;
}