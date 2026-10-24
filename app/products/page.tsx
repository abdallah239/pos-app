import { prisma } from '@/prisma';
import { z } from 'zod';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { productSchema, productUpdateSchema } from '@/validation';
import { getCurrentUser } from '@/session';

interface Product {
  id: string;
  name: string;
  price: number;
  sku: string;
  category: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductFormState {
  isEditing: boolean;
  productId?: string;
  name: string;
  price: number;
  sku: string;
  category: string;
  errors: {
    name?: string;
    price?: string;
    sku?: string;
    category?: string;
    duplicate?: string;
  };
  success: boolean;
}

export default async function ProductsPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';

  // Check permission
  await requirePermission(request, 'products:view');

  // Handle form submission
  const [formState, setFormState] = React.useState<ProductFormState>({
    isEditing: false,
    name: '',
    price: 0,
    sku: '',
    category: '',
    errors: {},
    success: false,
  });

  // Fetch products with search and pagination
  const search = request.nextUrl.searchParams.get('search') || '';
  const page = Number(request.nextUrl.searchParams.get('page') || '1');
  const limit = 10;

  const whereClause = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: whereClause }),
  ]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = productSchema.parse({
        name: formState.name,
        price: formState.price,
        sku: formState.sku,
        category: formState.category,
      });

      if (formState.isEditing && formState.productId) {
        // Check for duplicate SKU excluding current product
        const existingProduct = await prisma.product.findFirst({
          where: {
            sku: validated.sku,
            NOT: { id: formState.productId },
          },
        });

        if (existingProduct) {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, sku: 'SKU already exists' },
          }));
          return;
        }

        await prisma.product.update({
          where: { id: formState.productId },
          data: {
            name: validated.name,
            price: validated.price,
            sku: validated.sku,
            category: validated.category,
          },
        });
      } else {
        // Check for duplicate SKU
        const existingProduct = await prisma.product.findFirst({
          where: { sku: validated.sku },
        });

        if (existingProduct) {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, sku: 'SKU already exists' },
          }));
          return;
        }

        await prisma.product.create({
          data: {
            ...validated,
            createdById: user.id,
          },
        });
      }

      setFormState({
        ...formState,
        isEditing: false,
        name: '',
        price: 0,
        sku: '',
        category: '',
        errors: {},
        success: true,
      });

      // Reset success after a moment
      setTimeout(() => {
        setFormState(prev => ({ ...prev, success: false }));
      }, 3000);
    } catch (error: any) {
      if (error.errors) {
        const errors: ProductFormState['errors'] = {};
        error.errors.forEach((e: any) => {
          errors[e.path as keyof ProductFormState['errors']] = e.message;
        });
        setFormState(prev => ({ ...prev, errors }));
      } else {
        setFormState(prev => ({ ...prev, errors: { generic: error.message } }));
      }
    }
  };

  // Handle clear form
  const handleClear = () => {
    setFormState({
      isEditing: false,
      name: '',
      price: 0,
      sku: '',
      category: '',
      errors: {},
      success: false,
    });
  };

  // Handle edit
  const handleEdit = (product: Product) => {
    setFormState({
      isEditing: true,
      productId: product.id,
      name: product.name,
      price: product.price,
      sku: product.sku,
      category: product.category,
      errors: {},
      success: false,
    });
  };

  // Handle delete
  const handleDelete = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await prisma.product.delete({
        where: { id: productId },
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
              <span className="font-medium text-lg text-gray-900">Products</span>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <a
                  href="#"
                  onClick={handleClear}
                  className="px-3 py-1 text-sm text-blue-600 rounded-md hover:bg-blue-100"
                >
                  Clear Form
                </a>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Management</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
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
                disabled={formState.isEditing}
                autoComplete="off"
              />
              {formState.errors.name && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (cents)
              </label>
              <input
                type="number"
                name="price"
                value={formState.price}
                onChange={(e) =>
                  setFormState(prev => ({
                    ...prev,
                    price: Number(e.target.value) || 0,
                  }))
                }
                min={0}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={formState.isEditing}
              />
              {formState.errors.price && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.price}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU
              </label>
              <input
                type="text"
                name="sku"
                value={formState.sku}
                onChange={(e) =>
                  setFormState(prev => ({
                    ...prev,
                    sku: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={formState.isEditing}
                autoComplete="off"
              />
              {formState.errors.sku && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.sku}</p>
              )}
              {formState.errors.duplicate && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.duplicate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                name="category"
                value={formState.category}
                onChange={(e) =>
                  setFormState(prev => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={formState.isEditing}
              />
              {formState.errors.category && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.category}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${formState.isEditing ? 'bg-yellow-600 text-yellow-100' : 'bg-blue-600 text-white'}`}
                disabled={formState.isEditing ? false : true}
              >
                {formState.isEditing ? 'Update Product' : 'Create Product'}
              </button>

              {formState.isEditing && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="ml-2 px-3 py-1 text-sm text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Products table */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Products ({totalCount} total)
          </h3>

          {products.length === 0 && (
            <p className="text-gray-500">
              No products found. Create your first product above.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-max table-auto">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Name</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Price</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">SKU</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Category</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Created By</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Created At</th>
                  {isAdmin && (
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                )}
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {product.createdBy?.name && (
                        <p className="text-xs text-gray-500">
                          Created by {product.createdBy.name}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-gray-900">${(product.price / 100).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{product.price}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-sm text-gray-600">{product.sku}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-sm text-gray-600">{product.category}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-gray-500">
                        {product.createdAt.toLocaleDateString()}
                      </p>
                    </td>
                    {isAdmin && (
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 hover underline text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover underline text-xs"
                            onClick={window.confirm('Are you sure you want to delete this product?')}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > limit && (
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
      </main>
    </div>
  );
}