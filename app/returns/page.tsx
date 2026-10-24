import { prisma } from '@/prisma';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { z } from 'zod';

interface SaleReturnFormState {
  isEditing: boolean;
  returnId?: string;
  originalSaleId: string;
  reason: string;
  status: string;
  restocked: boolean;
  subtotal: number;
  discountAmount: number;
  refundAmount: number;
  errors: {
    originalSale?: string;
    refund?: string;
  };
  success: boolean;
}

interface SaleReturnItemForm {
  productId: string;
  quantity: number;
  refundPrice: number;
  totalRefund: number;
  productName: string;
}

export default async function ReturnsPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isManager = user.role === 'MANAGER' || user.role === 'ADMIN';

  // Check permission
  await requirePermission(request, 'returns:view');

  // Fetch sales for reference
  const sales = await prisma.sale.findMany({
    where: { status: 'completed' },
    include: { customer: true, cashier: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // State for return form
  const [formState, setFormState] = useState<SaleReturnFormState>({
    isEditing: false,
    originalSaleId: '',
    reason: '',
    status: 'pending',
    restocked: true,
    subtotal: 0,
    discountAmount: 0,
    refundAmount: 0,
    errors: {},
    success: false,
  });

  // State for return items
  const [itemsState, setItemsState] = useState<SaleReturnItemForm[]>([]);

  // Fetch eligible items from a sale for return
  const fetchEligibleItems = async (saleId: string) => {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } } },
    });

    if (!sale) {
      setFormState(prev => ({ ...prev, errors: { originalSale: 'Sale not found' } }));
      return;
    }

    // Calculate eligible return quantities (simplified - all sold quantities)
    const eligibleItems = sale.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      refundPrice: item.unitPrice, // price at time of sale
      totalRefund: item.totalPrice, // total for this line
      productName: item.name,
    }));

    setItemsState(eligibleItems);
    setFormState(prev => ({ ...prev, originalSaleId: saleId }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate totals
    let subtotal = 0;
    let discountAmount = 0;
    let refundAmount = 0;

    for (const item of itemsState) {
      subtotal += item.refundPrice * item.quantity;
      discountAmount += item.refundPrice * item.quantity * 0.1; // 10% restocking fee or discount
      refundAmount += item.totalRefund;
    }

    const validated = z
      .object({
        originalSaleId: z.string().min(1, 'Original sale is required'),
        reason: z.string().min(1, 'Return reason is required'),
        status: z.enum(['pending', 'approved', 'completed']),
        restocked: z.boolean(),
      })
      .parse(formState);

    try {
      // Create return transaction within prisma transaction
      const result = await prisma.$transaction(async tx => {
        // 1. Create sale return record
        const returnRecord = await tx.saleReturn.create({
          data: {
            originalSaleId: validated.originalSaleId,
            cashierId: user.id,
            reason: validated.reason,
            status: validated.status,
            restocked: validated.restocked,
            subtotal: Math.round(subtotal * 100), // in cents
            discountAmount: Math.round(discountAmount * 100),
            refundAmount: Math.round(refundAmount * 100),
          },
        });

        // 2. Create return items and update inventory
        for (const item of itemsState) {
          // 2a. Create sale return item
          await tx.saleReturnItem.create({
            data: {
              returnId: returnRecord.id,
              productId: item.productId,
              name: item.productName,
              quantity: item.quantity,
              refundPrice: Math.round(item.refundPrice * 100), // in cents
              totalRefund: Math.round(item.totalRefund * 100), // in cents
            },
          });

          // 2b. Create inventory movement (incoming - restocking)
          if (validated.restocked) {
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                type: 'RETURN',
                quantity: item.quantity, // Positive quantity for incoming/restock
                referenceId: returnRecord.id,
                referenceType: 'sale_return',
                description: `Return sale return ${returnRecord.id}`,
              },
            });
          }
        }

        return { returnRecord, items: itemsState };
      });

      setFormState({
        isEditing: false,
        originalSaleId: '',
        reason: '',
        status: 'pending',
        restocked: true,
        subtotal: 0,
        discountAmount: 0,
        refundAmount: 0,
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
        errors: { generic: error instanceof Error ? error.message : 'Failed to process return' },
      }));
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
              <span className="font-medium text-lg text-gray-900">Returns</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Sales Returns & Refunds</h1>

          {/* Sale Selection */}
          {sales.length === 0 && (
            <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
              <p className="text-gray-500">
                No completed sales found. Make a sale first to process returns.
              </p>
            </div>
          )}
          {sales.length > 0 && (
            <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Sale for Return</h3>
              <form onSubmit={() => {}} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale
                  </label>
                  <select
                    onChange={(e) => fetchEligibleItems(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a sale</option>
                    {sales.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        {sale.invoiceNumber} - {sale.totalAmount / 100} EGP - {sale.createdAt.toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
          )}

          {/* Return Form */}
          {formState.originalSaleId && (
            <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Return for Sale {sales.find(s => s.id === formState.originalSaleId)?.invoiceNumber || 'N/A'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Return Reason
                  </label>
                  <textarea
                    value={formState.reason}
                    onChange={(e) =>
                      setFormState(prev => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    autoComplete="off"
                  />
                  {formState.errors.refund && (
                    <p className="mt-1 text-sm text-red-600">{formState.errors.refund}</p>
                  )}
                </div>

                {/* Return Items */}
                {itemsState.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-2">Items to Return</h4>
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="p-3 text-left text-xs font-medium text-gray-600">Product</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-600">Qty</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-600">Refund Price</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-600">Total Refund</th>
                          <th className="p-3 text-left text-xs font-medium text-gray-600">Restock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsState.map((item) => (
                          <tr key={item.productId} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="p-3">
                              <p className="font-medium text-gray-900">{item.productName}</p>
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  setItemsState(prev =>
                                    prev.map(i =>
                                      i.productId === item.productId ? { ...i, quantity: Number(e.target.value) } : i
                                    )
                                  )
                                }
                                min="1"
                                className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                value={item.refundPrice}
                                onChange={(e) =>
                                  setItemsState(prev =>
                                    prev.map(i =>
                                      i.productId === item.productId ? { ...i, refundPrice: Number(e.target.value) } : i
                                    )
                                  )
                                }
                                min="0"
                                className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm"
                              />
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-gray-900">{item.totalRefund / 100} EGP</p>
                            </td>
                            <td className="p-3">
                              <select
                                onChange={(e) =>
                                  setItemsState(prev =>
                                    prev.map(i =>
                                      i.productId === item.productId ? { ...i, restocked: e.target.value === 'true' } : i
                                    )
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm"
                              >
                                <option value="true">Restock</option>
                                <option value="false">Damaged/Non-restockable</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Restock Items
                  </label>
                  <label className="flex items-center gap-2 px-2 py-1 rounded-md border border-gray-300 cursor-pointer ${
                    formState.restocked ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'
                  }" onClick={() => setFormState(prev => ({ ...prev, restocked: !prev.restocked }))}>
                    <input
                      type="radio"
                      name="restocked"
                      value="true"
                      checked={formState.restocked}
                      className="hidden peer"
                    />
                    <span>Restock items (return to inventory)</span>
                  </label>
                  <label className="flex items-center gap-2 px-2 py-1 rounded-md border border-gray-300 cursor-pointer ${
                    !formState.restocked ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-600'
                  }" onClick={() => setFormState(prev => ({ ...prev, restocked: !prev.restocked }))}>
                    <input
                      type="radio"
                      name="restocked"
                      value="false"
                      checked={!formState.restocked}
                      className="hidden peer"
                    />
                    <span>Discard items (damaged/non-restockable)</span>
                  </label>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Subtotal: {formState.subtotal / 100} EGP</p>
                  <p className="text-sm text-gray-500">Discount: {formState.discountAmount / 100} EGP</p>
                  <p className="text-sm font-medium text-gray-900">Refund Amount: {formState.refundAmount / 100} EGP</p>
                </div>

                <div>
                  <button
                    type="submit"
                    className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
                      formState.isEditing ? 'bg-yellow-600 text-yellow-100' : 'bg-green-600 text-white'}
                    `}
                  >
                    {formState.isEditing ? 'Update Return' : 'Process Return'}
                  </button>

                  {formState.isEditing && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormState({
                          ...formState,
                          isEditing: false,
                          originalSaleId: '',
                          reason: '',
                          status: 'pending',
                          restocked: true,
                          subtotal: 0,
                          discountAmount: 0,
                          refundAmount: 0,
                          errors: {},
                          success: false,
                          itemsState: [],
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

          {/* No sale selected */}
          {!formState.originalSaleId && sales.length > 0 && (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-gray-500">
                Select a sale from the dropdown above to process a return.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}