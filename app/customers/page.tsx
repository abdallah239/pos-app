import { prisma } from '@/prisma';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { z } from 'zod';

interface CustomerFormState {
  isEditing: boolean;
  customerId?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  creditLimit: number;
  isActive: boolean;
  errors: {
    name?: string;
    duplicate?: string;
    creditLimit?: string;
  };
  success: boolean;
}

export default async function CustomersPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isAdmin = user.role === 'ADMIN';

  // Check permission
  await requirePermission(request, 'customers:view');

  // Fetch customers
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  // State for customer form
  const [formState, setFormState] = useState<CustomerFormState>({
    isEditing: false,
    customerId: undefined,
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    creditLimit: 0,
    isActive: true,
    errors: {},
    success: false,
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validated = z
      .object({
        name: z.string().min(1, 'Customer name is required'),
        email: z.string().email('Invalid email address'),
        phone: z.string().optional(),
        address: z.string().optional(),
        taxId: z.string().min(1, 'Tax ID is required'),
        creditLimit: z.number().int().min(0, 'Credit limit must be non-negative'),
        isActive: z.boolean(),
      })
      .parse(formState);

    try {
      if (formState.isEditing && formState.customerId) {
        await prisma.customer.update({
          where: { id: formState.customerId },
          data: { ...validated },
        });
      } else {
        await prisma.customer.create({ data: { ...validated } });
      }

      setFormState({
        isEditing: false,
        customerId: undefined,
        name: '',
        email: '',
        phone: '',
        address: '',
        taxId: '',
        creditLimit: 0,
        isActive: true,
        errors: {},
        success: true,
      });

      setTimeout(() => {
        setFormState({
          ...formState,
          success: false,
        });
      }, 3000);
    } catch (error: any) {
      setFormState(prev => ({
        ...prev,
        errors: { generic: error instanceof Error ? error.message : 'Failed to save customer' },
      }));
    }
  };

  // Handle customer delete
  const handleDelete = async (customerId: string) => {
    if (window.confirm('Are you sure you want to deactivate this customer?')) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { isActive: false },
      });
    }
  };

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
              <span className="font-medium text-lg text-gray-900">Customers</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Customer Management</h1>

          {/* Customers List */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="border rounded-lg p-4 hover:bg-blue-50 transition-colors"
                >
                  <h3 className="text-sm font-medium text-gray-900">{customer.name}</h3>
                  <p className="text-xs text-gray-500">
                    Email: {customer.email || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Phone: {customer.phone || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Credit Limit: {customer.creditLimit} EGP
                  </p>
                  <span
                    className={`inline px-2 py-1 text-xs rounded-md ${
                      customer.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {customer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {!customers.length && (
                <p className="col-span-3 text-gray-500 text-center">
                  No customers found. Create your first customer above.
                </p>
              )}
            </div>
          </div>

          {/* Add Customer Form */}
          {isAdmin && (
            <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Add New Customer</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formState.name}
                    onChange={(e) =>
                      setFormState(prev => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="off"
                  />
                  {formState.errors.name && (
                    <p className="mt-1 text-sm text-red-600">{formState.errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={(e) =>
                      setFormState(prev => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="off"
                  />
                  {formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600">{formState.errors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formState.phone}
                      onChange={(e) =>
                        setFormState(prev => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      name="taxId"
                      value={formState.taxId}
                      onChange={(e) =>
                        setFormState(prev => ({ ...prev, taxId: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Credit Limit (EGP)
                    </label>
                    <input
                      type="number"
                      name="creditLimit"
                      value={formState.creditLimit}
                      onChange={(e) =>
                        setFormState(prev => ({
                          ...prev,
                          creditLimit: Number(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {formState.errors.creditLimit && (
                      <p className="mt-1 text-sm text-red-600">{formState.errors.creditLimit}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formState.isActive}
                      onChange={(e) =>
                        setFormState(prev => ({ ...prev, isActive: e.target.value === 'true' }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                      formState.isEditing ? 'bg-yellow-600 text-yellow-100' : 'bg-blue-600 text-white'}
                    `}
                  >
                    {formState.isEditing ? 'Update Customer' : 'Create Customer'}
                  </button>

                  {formState.isEditing && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormState({
                          ...formState,
                          isEditing: false,
                          name: '',
                          email: '',
                          phone: '',
                          address: '',
                          taxId: '',
                          creditLimit: 0,
                          isActive: true,
                          errors: {},
                          success: false,
                        })
                      }
                      className="ml-2 px-3 py-1 text-sm text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Customer Transactions */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Customer Transactions</h3>
            {customers.length > 0 && (
              <p className="text-gray-500">
                Click on a customer to view their transaction history (coming soon)
              </p>
            )}
            {customers.length === 0 && (
              <p className="text-gray-500">
                Create a customer first to view their transaction history.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}