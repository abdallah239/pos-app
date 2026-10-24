"use client";

import { prisma } from '@/prisma';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { useState } from 'react';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number; // price in cents at time of addition
  totalPrice: number; // quantity * unitPrice in cents
  discount: number; // discount in cents for this line
  barcode?: string;
}

interface POSState {
  cart: CartItem[];
  searchQuery: string;
  selectedProduct: { id: string; name: string; price: number; sku: string; barcode?: string } | null;
  isSearching: boolean;
  paymentMethod: 'cash' | 'card' | 'store_credit' | 'mixed';
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cashReceived: number;
  change: number;
  errors: {
    insufficientStock?: string;
    invalidPayment?: string;
    generic?: string;
  };
  success: boolean;
  creatingSale: boolean;
}

export default async function CashierPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isCashier = user.role === 'CASHIER' || user.role === 'ADMIN' || user.role === 'MANAGER';

  // Initialize state
  const [state, setState] = useState<POSState>({
    cart: [],
    searchQuery: '',
    selectedProduct: null,
    isSearching: false,
    paymentMethod: 'cash',
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
    cashReceived: 0,
    change: 0,
    errors: {},
    success: false,
    creatingSale: false,
  });

  // Fetch products for search
  const fetchProducts = async (query: string) => {
    try {
      setState(prev => ({ ...prev, isSearching: true }));
      const whereClause = query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { sku: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {};

      const products = await prisma.product.findMany({
        where: whereClause,
        include: { category: true },
        take: 10,
      });

      setState(prev => ({
        ...prev,
        selectedProduct: products.length === 1 ? products[0] : null,
        isSearching: false,
        searchQuery: query,
      }));
    } catch (error) {
      console.error('Search error:', error);
      setState(prev => ({ ...prev, isSearching: false }));
    }
  };

  // Add product to cart
  const addToCart = (product: { id: string; name: string; price: number; sku: string; barcode?: string }) => {
    const existingIndex = state.cart.findIndex(item => item.productId === product.id);

    if (existingIndex >= 0) {
      const updatedCart = [...state.cart];
      updatedCart[existingIndex].quantity += 1;
      updatedCart[existingIndex].totalPrice = updatedCart[existingIndex].unitPrice * updatedCart[existingIndex].quantity;
      setState({ ...state, cart: updatedCart });
    } else {
      const newItem: CartItem = {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
        discount: 0,
        barcode: product.barcode,
      };
      setState({ ...state, cart: [...state.cart, newItem] });
    }
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setState({ ...state, cart: state.cart.filter(item => item.id !== itemId) });
  };

  // Adjust quantity
  const adjustQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const updatedCart = state.cart.map(item =>
      item.id === itemId ? { ...item, quantity, totalPrice: item.unitPrice * quantity } : item
    );
    setState({ ...state, cart: updatedCart });
  };

  // Recalculate totals
  const recalculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;

    for (const item of state.cart) {
      subtotal += item.totalPrice;
      totalDiscount += item.discount;
    }

    const taxRate = 0.1; // 10% tax
    const taxableAmount = subtotal - totalDiscount;
    const tax = Math.round(taxableAmount * taxRate / 10) * 10; // Rounded to nearest 10

    const total = subtotal - totalDiscount + tax;

    setState({
      ...state,
      subtotal,
      discountAmount: totalDiscount,
      taxAmount: tax,
      total,
    });
  };

  // Handle payment method change
  const handlePaymentMethodChange = (method: 'cash' | 'card' | 'store_credit' | 'mixed') => {
    setState({ ...state, paymentMethod: method, cashReceived: 0, change: 0, errors: {} });
  };

  // Handle cash received
  const handleCashReceived = (amount: number) => {
    setState({ ...state, cashReceived: amount, change: Math.max(0, amount - state.total) });
  };

  // Clear cart and reset state
  const clearCart = () => {
    setState({
      cart: [],
      searchQuery: '',
      selectedProduct: null,
      paymentMethod: 'cash',
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
      cashReceived: 0,
      change: 0,
      errors: {},
      success: false,
    });
  };

  // Finalize sale - call API route
  const handleFinalizeSale = async () => {
    if (state.creatingSale || state.cart.length === 0) return;

    // Validate payment
    if (state.paymentMethod === 'cash' && state.cashReceived < state.total) {
      setState({ ...state, errors: { invalidPayment: 'Insufficient cash received. Please provide the full amount or use split payment.' } });
      return;
    }

    setState({ ...state, creatingSale: true, errors: {} });

    try {
      const idempotencyKey = crypto.randomUUID();

      const result = await fetch('/api/cashier/sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: state.cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            name: item.name,
            barcode: item.barcode,
          })),
          paymentMethod: state.paymentMethod,
          cashReceived: state.paymentMethod === 'cash' ? state.cashReceived : undefined,
          subtotal: state.subtotal,
          discountAmount: state.discountAmount,
          taxAmount: state.taxAmount,
          totalAmount: state.total,
          idempotencyKey,
        }),
      });

      const data = await result.json();

      if (result.ok) {
        setState({
          cart: [],
          searchQuery: '',
          selectedProduct: null,
          paymentMethod: 'cash',
          subtotal: 0,
          discountAmount: 0,
          taxAmount: 0,
          total: 0,
          cashReceived: 0,
          change: 0,
          errors: {},
          success: true,
          creatingSale: false,
        });
        // Show success after a moment
        setTimeout(() => {
          setState({ ...state, success: false });
        }, 3000);
      } else {
        setState({ ...state, errors: { generic: data.message || 'Failed to finalize sale' }, creatingSale: false });
      }
    } catch (error) {
      console.error('Sale finalization error:', error);
      setState({ ...state, errors: { generic: 'An error occurred while finalizing the sale' }, creatingSale: false });
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchProducts(state.searchQuery);
  }, [state.searchQuery]);

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
              <span className="font-medium text-lg text-gray-900">Cashier</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">POS Checkout</h1>

          {/* Product Search Section */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Search Product</label>
                <input
                  type="text"
                  value={state.searchQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setState({ ...state, searchQuery: query });
                    fetchProducts(query);
                  }}
                  placeholder="Search by name, SKU, or barcode"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="off"
                />
              </div>

              {state.selectedProduct && (
                <div className="md:col-span-2">
                  <div className="mt-2 p-3 bg-white rounded-md border border-blue-200">
                    <p className="font-medium text-gray-900">{state.selectedProduct.name}</p>
                    <p className="text-xs text-gray-500">SKU: {state.selectedProduct.sku}</p>
                    <p className="text-lg font-bold text-blue-600">{state.selectedProduct.price} EGP</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (state.selectedProduct) {
                      addToCart(state.selectedProduct);
                      setState({ ...state, selectedProduct: null });
                    }
                  }}
                  disabled={!state.selectedProduct}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>

          {/* Cart Drawer */}
          {state.cart.length > 0 && (
            <div className="fixed right-0 top-0 w-full h-full bg-black/50 backdrop-blur-sm hidden z-50 block">
              <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-2xl max-h-screen overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Cart</h2>
                  <button
                    onClick={clearCart}
                    className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>

                <div className="h-96 overflow-y-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="p-3 text-left text-xs font-medium text-gray-600">Item</th>
                        <th className="p-3 text-left text-xs font-medium text-gray-600">Qty</th>
                        <th className="p-3 text-left text-xs font-medium text-gray-600">Price</th>
                        <th className="p-3 text-left text-xs font-medium text-gray-600">Total</th>
                        <th className="p-3 text-left text-xs font-medium text-gray-600">Discount</th>
                        <th className="p-3 text-left text-xs font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.cart.map((item) => (
                        <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.barcode && <p className="text-xs text-gray-500">Barcode: {item.barcode}</p>}
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => adjustQuantity(item.id, Number(e.target.value))}
                              min="1"
                              className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm"
                            />
                          </td>
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{item.unitPrice / 100} EGP</p>
                          </td>
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{item.totalPrice / 100} EGP</p>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={item.discount}
                              onChange={(e) => {
                                const discount = parseInt(e.target.value) || 0;
                                const updatedCart = state.cart.map(i =>
                                  i.id === item.id ? { ...i, discount } : i
                                );
                                setState({ ...state, cart: updatedCart });
                                recalculateTotals();
                              }}
                              min="0"
                              max={item.totalPrice}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm"
                            />
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-600 hover underline text-sm"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Subtotal</p>
                      <p className="font-bold">{state.subtotal / 100} EGP</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Discount</p>
                      <p className="font-bold text-red-600">-{state.discountAmount / 100} EGP</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-gray-500">Tax (10%)</p>
                      <p className="font-bold">{state.taxAmount / 100} EGP</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-bold text-blue-600">{state.total / 100} EGP</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-gray-500">Cash Received</p>
                    <input
                      type="number"
                      value={state.cashReceived}
                      onChange={(e) => handleCashReceived(Number(e.target.value))}
                      min={state.total}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                    <p className="mt-2 text-lg font-bold">{state.change / 100} EGP change</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleFinalizeSale}
                      disabled={state.creatingSale}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {state.creatingSale ? 'Finalizing...' : 'Finalize Sale'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Methods Section */}
          {state.cart.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Payment Method</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePaymentMethodChange('cash')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${state.paymentMethod === 'cash' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Cash
                </button>
                <button
                  onClick={() => handlePaymentMethodChange('card')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${state.paymentMethod === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Card
                </button>
              </div>

              {state.paymentMethod === 'cash' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-600">Amount Received</p>
                  <input
                    type="number"
                    value={state.cashReceived}
                    onChange={(e) => handleCashReceived(Number(e.target.value))}
                    min={state.total}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-lg font-bold text-blue-600">{state.change / 100} EGP change</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}