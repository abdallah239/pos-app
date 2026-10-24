import { prisma } from '@/prisma';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { z } from 'zod';
import { productSchema } from '@/validation';

interface SupplierFormState {
  isEditing: boolean;
  supplierId?: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  status: string;
  errors: {
    name?: string;
    duplicate?: string;
  };
  success: boolean;
}

interface PurchaseInvoiceFormState {
  isEditing: boolean;
  purchaseInvoiceId?: string;
  supplierId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  discountPercent: number;
  lineItems: PurchaseInvoiceLineForm[];
  errors: {
    supplier?: string;
    invoice?: string;
    lineItem?: string;
  };
  success: boolean;
}

interface PurchaseInvoiceLineForm {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productName: string;
}

export default async function SuppliersPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isAdmin = user.role === 'ADMIN';

  // Check permission
  await requirePermission(request, 'suppliers:view');

  // State for supplier form
  const [supplierState, setSupplierState] = useState<SupplierFormState>({
    isEditing: false,
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    status: 'active',
    errors: {},
    success: false,
  });

  // State for purchase invoice form
  const [invoiceState, setInvoiceState] = useState<PurchaseInvoiceFormState>({
    isEditing: false,
    purchaseInvoiceId: undefined,
    supplierId: '',
    invoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'draft',
    discountPercent: 0,
    lineItems: [],
    errors: {},
    success: false,
  });

  // Fetch suppliers
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  // Fetch purchase invoices with pagination
  const search = request.nextUrl.searchParams.get('search') || '';
  const page = Number(request.nextUrl.searchParams.get('page') || '1');
  const limit = 10;

  const whereClause = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [invoices, totalCount] = await Promise.all([
    prisma.purchaseInvoice.findMany({
      where: whereClause,
      include: { supplier: true },
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseInvoice.count({ where: whereClause }),
  ]);

  // Fetch products for line items
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    take: 50,
  });

  // Add product to invoice line items
  const handleAddProduct = (product: { id: string; name: string; price: number }) => {
    const existingIndex = invoiceState.lineItems.findIndex(
      item => item.productId === product.id
    );

    if (existingIndex >= 0) {
      setInvoiceState(prev => ({
        ...prev,
        lineItems: prev.lineItems.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + 1, totalPrice: item.unitPrice * (item.quantity + 1) }
            : item
        ),
      }));
    } else {
      const newLine: PurchaseInvoiceLineForm = {
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
        productName: product.name,
      };
      setInvoiceState(prev => ({
        ...prev,
        lineItems: [...prev.lineItems, newLine],
      }));
    }
  };

  // Remove line item
  const handleRemoveLine = (productId: string) => {
    setInvoiceState(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter(item => item.productId !== productId),
    }));
  };

  // Update line item quantity/price
  const handleUpdateLine = (
    productId: string,
    field: 'quantity' | 'unitPrice',
    value: number
  ) => {
    setInvoiceState(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item =>
        item.productId === productId
          ? { ...item, [field]: value, totalPrice: item.quantity * item.unitPrice }
          : item
      ),
    }));
  };

  // Handle supplier form submission
  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validated = z
      .object({
        name: z.string().min(1, 'Supplier name is required'),
        contactName: z.string().min(1, 'Contact name is required').optional(),
        phone: z.string().optional(),
        email: z.string().email('Invalid email').optional(),
        address: z.string().optional(),
        taxId: z.string().min(1, 'Tax ID is required'),
        status: z.string().min(1, 'Status is required'),
      })
      .parse(supplierState);

    try {
      if (supplierState.isEditing && supplierState.supplierId) {
        await prisma.supplier.update({
          where: { id: supplierState.supplierId },
          data: { ...validated },
        });
      } else {
        await prisma.supplier.create({ data: { ...validated } });
      }

      setSupplierState({
        isEditing: false,
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        taxId: '',
        status: 'active',
        errors: {},
        success: true,
      });

      setTimeout(() => {
        setSupplierState({
          ...supplierState,
          success: false,
        });
      }, 3000);
    } catch (error) {
      setSupplierState(prev => ({
        ...prev,
        errors: { generic: error instanceof Error ? error.message : 'Failed to save supplier' },
      }));
    }
  };

  // Handle invoice form submission
  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate totals
    let lineTotal = 0;
    for (const item of invoiceState.lineItems) {
      lineTotal += item.totalPrice;
    }

    const netAmount = lineTotal - Math.round((lineTotal * invoiceState.discountPercent) / 100);
    const totalAmount = netAmount; // Simplified - no tax on purchases typically

    try {
      const data = {
        supplierId: invoiceState.supplierId,
        invoiceNumber: invoiceState.invoiceNumber,
        issueDate: new Date(invoiceState.issueDate),
        dueDate: invoiceState.dueDate ? new Date(invoiceState.dueDate) : undefined,
        status: invoiceState.status,
        totalAmount: Math.round(totalAmount * 100), // Convert to cents
        discountPercent: invoiceState.discountPercent,
        netAmount: Math.round(netAmount * 100),
        lineItems: invoiceState.lineItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice * 100), // in cents
          totalPrice: Math.round(item.totalPrice * 100), // in cents
        })),
      };

      if (invoiceState.isEditing && invoiceState.purchaseInvoiceId) {
        await prisma.purchaseInvoice.update({
          where: { id: invoiceState.purchaseInvoiceId },
          data,
        });
      } else {
        await prisma.purchaseInvoice.create({ data });
      }

      setInvoiceState({
        isEditing: false,
        purchaseInvoiceId: undefined,
        supplierId: '',
        invoiceNumber: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        discountPercent: 0,
        lineItems: [],
        errors: {},
        success: true,
      });

      setTimeout(() => {
        setInvoiceState({
          ...invoiceState,
          success: false,
        });
      }, 3000);
    } catch (error) {
      setInvoiceState(prev => ({
        ...prev,
        errors: { generic: error instanceof Error ? error.message : 'Failed to save purchase invoice' },
      }));
    }
  };

  // Handle status filter change (simulated - would use URL params in real app)
  const statusFilter = 'all'; // Would come from URL params

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
              </div>
              <span className="font-medium text-lg text-gray-900">Suppliers</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Logged in as: {user.username}
              </span>

              <button
                onClick={() => window.location.href = '/logout'}
                className="px-3 py-1 text-xs text-gray-600 rounded-md hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Supplier Management</h1>

          {/* Suppliers List */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="border rounded-lg p-4 hover:bg-blue-50 transition-colors"
                >
                  <h3 className="text-sm font-medium text-gray-900">{supplier.name}</h3>
                  <p className="text-xs text-gray-500">
                    Contact: {supplier.contactName || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Phone: {supplier.phone || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Email: {supplier.email || 'N/A'}
                  </p>
                  <span
                    className={`inline px-2 py-1 text-xs rounded-md ${
                      supplier.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {supplier.status}
                  </span>
                </div>
              ))}
              {!suppliers.length && (
                <p className="col-span-3 text-gray-500 text-center">
                  No suppliers found. Add your first supplier above.
                </p>
              )}
            </div>
          </div>

          {/* Add Supplier Form */}
          {isAdmin && (
            <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Add New Supplier</h3>
              <form onSubmit={handleSupplierSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={supplierState.name}
                    onChange={(e) =>
                      setSupplierState(prev => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="off"
                  />
                  {supplierState.errors.name && (
                    <p className="mt-1 text-sm text-red-600">{supplierState.errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    name="contactName"
                    value={supplierState.contactName}
                    onChange={(e) =>
                      setSupplierState(prev => ({
                        ...prev,
                        contactName: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="off"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={supplierState.phone}
                      onChange={(e) =>
                        setSupplierState(prev => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={supplierState.email}
                      onChange={(e) =>
                        setSupplierState(prev => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      name="taxId"
                      value={supplierState.taxId}
                      onChange={(e) =>
                        setSupplierState(prev => ({ ...prev, taxId: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={supplierState.status}
                      onChange={(e) =>
                        setSupplierState(prev => ({ ...prev, status: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                      supplierState.isEditing ? 'bg-yellow-600 text-yellow-100' : 'bg-blue-600 text-white'}
                    `}
                  >
                    {supplierState.isEditing ? 'Update Supplier' : 'Create Supplier'}
                  </button>

                  {supplierState.isEditing && (
                    <button
                      type="button"
                      onClick={() => setSupplierState({ ...supplierState, isEditing: false, name: '', contactName: '', phone: '', email: '', taxId: '', status: 'active', errors: {}, success: false })}
                      className="ml-2 px-3 py-1 text-sm text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Purchase Invoices */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Purchase Invoices</h3>

            {isAdmin && (
              <div className="bg-white rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Create Purchase Invoice</h3>
                <form onSubmit={handleInvoiceSubmit} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier
                    </label>
                    <select
                      value={invoiceState.supplierId}
                      onChange={(e) =>
                        setInvoiceState(prev => ({ ...prev, supplierId: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      name="invoiceNumber"
                      value={invoiceState.invoiceNumber}
                      onChange={(e) =>
                        setInvoiceState(prev => ({ ...prev, invoiceNumber: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      name="issueDate"
                      value={invoiceState.issueDate}
                      onChange={(e) =>
                        setInvoiceState(prev => ({ ...prev, issueDate: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      name="dueDate"
                      value={invoiceState.dueDate}
                      onChange={(e) =>
                        setInvoiceState(prev => ({ ...prev, dueDate: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      name="discountPercent"
                      value={invoiceState.discountPercent}
                      onChange={(e) =>
                        setInvoiceState(prev => ({ ...prev, discountPercent: Number(e.target.value) || 0 }))
                      }
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </form>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Invoice</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Supplier</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Issue Date</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Due Date</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Status</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Total</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Line Items</th>
                    {isAdmin && {
                      th: <th className="p-3 text-left text-xs font-medium text-gray-600">Actions</th>
                    }}
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="p-6 text-center text-gray-500">
                        No purchase invoices found.
                      </td>
                    </tr>
                  )}
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">{invoice.issueDate}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm text-gray-600">{invoice.supplier?.name || 'N/A'}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-xs text-gray-500">{invoice.issueDate}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-xs text-gray-500">{invoice.dueDate}</p>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline px-2 py-1 text-xs rounded-md ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : invoice.status === 'received'
                                ? 'bg-blue-100 text-blue-800'
                                : invoice.status === 'draft'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-gray-900">
                          {invoice.netAmount / 100} EGP
                        </p>
                        <p className="text-xs text-gray-500">{invoice.lineItems.length} items</p>
                      </td>
                      <td className="p-3">
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              className="text-blue-600 hover underline text-xs"
                            >
                              View
                            </button>
                            <button
                              className="text-red-600 hover underline text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isAdmin && totalCount > limit && (
              <div className="mt-4 flex justify-center">
                <nav>
                  <ul className="flex list-none gap-2">
                    <li>
                      <a
                        href={`?page=${page - 1}&search=${search}`}
                        className={page <= 1 ? 'disabled text-gray-400' : 'text-blue-600 hover underline'}
                        aria-label="Previous"
                      >
                        Previous
                      </a>
                    </li>
                    <li>
                      <a
                        href={`?page=${page + 1}&search=${search}`}
                        className={page >= Math.ceil(totalCount / limit) ? 'disabled text-gray-400' : 'text-blue-600 hover underline'}
                        aria-label="Next"
                      >
                        Next
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}