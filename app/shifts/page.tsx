import { prisma } from '@/prisma';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { useState, useEffect } from 'react';

interface CashShiftFormState {
  isEditing: boolean;
  shiftId?: string;
  cashierId: string;
  openingBalance: number;
  openingAt: string;
  closingAt?: string;
  closingBalance?: number;
  expectedClosing?: number;
  discrepancy?: number;
  status: 'open' | 'closed' | 'pending_reconciliation';
  notes: string;
  errors: {
    openingBalance?: string;
    discrepancy?: string;
  };
  success: boolean;
}

export default async function CashShiftsPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isManager = user.role === 'MANAGER' || user.role === 'ADMIN';

  // Check permission
  await requirePermission(request, 'shifts:view');

  // Fetch open shifts
  const openShifts = await prisma.cashShift.findMany({
    where: { status: 'open' },
    include: { cashier: true },
    orderBy: { openingAt: 'desc' },
  });

  // Fetch shift history
  const closedShifts = await prisma.cashShift.findMany({
    where: { status: 'closed' },
    include: { cashier: true },
    orderBy: { closingAt: 'desc' },
    take: 20,
  });

  // State for shift form
  const [shiftState, setShiftState] = useState<CashShiftFormState>({
    isEditing: false,
    shiftId: undefined,
    cashierId: user.id,
    openingBalance: 0,
    openingAt: new Date().toISOString().split('T')[0],
    closingAt: undefined,
    closingBalance: undefined,
    expectedClosing: 0,
    discrepancy: 0,
    status: 'open',
    notes: '',
    errors: {},
    success: false,
  });

  // Calculate expected closing
  const calculateExpected = () => {
    // Expected = Opening + (Completed Sales - Refunds) + Adjustments - Payments
    // Simplified calculation for demonstration
    let totalSales = 0;
    if (shiftState.openingBalance >= 0) {
      // This is a simplified calc - real implementation would sum up sale amounts
      totalSales = 0; // Would need to query sales for this shift
    }

    const expected = shiftState.openingBalance + totalSales;
    setShiftState(prev => ({ ...prev, expectedClosing: expected }));
  };

  // Handle opening balance change
  const handleOpeningBalance = (value: number) => {
    setShiftState(prev => ({
      ...prev,
      openingBalance: value,
      discrepancy: undefined,
    }));
    calculateExpected();
  };

  // Handle closing balance change
  const handleClosingBalance = (value: number) => {
    setShiftState(prev => ({
      ...prev,
      closingBalance: value,
    }));
    const discrepancy = value - shiftState.expectedClosing;
    setShiftState(prev => ({ ...prev, discrepancy }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        cashierId: shiftState.cashierId,
        openingBalance: shiftState.openingBalance,
        openingAt: new Date(shiftState.openingAt),
        closingAt: shiftState.closingAt ? new Date(shiftState.closingAt) : undefined,
        closingBalance: shiftState.closingBalance,
        expectedClosing: shiftState.expectedClosing,
        discrepancy: shiftState.discrepancy,
        status: shiftState.status,
        notes: shiftState.notes,
      };

      if (shiftState.isEditing && shiftState.shiftId) {
        await prisma.cashShift.update({
          where: { id: shiftState.shiftId },
          data,
        });
      } else {
        await prisma.cashShift.create({ data });
      }

      setShiftState({
        isEditing: false,
        shiftId: undefined,
        cashierId: user.id,
        openingBalance: 0,
        openingAt: new Date().toISOString().split('T')[0],
        closingAt: undefined,
        closingBalance: undefined,
        expectedClosing: 0,
        discrepancy: 0,
        status: 'open',
        notes: '',
        errors: {},
        success: true,
      });

      setTimeout(() => {
        setShiftState({
          ...shiftState,
          success: false,
        });
      }, 3000);
    } catch (error) {
      setShiftState(prev => ({
        ...prev,
        errors: { generic: error instanceof Error ? error.message : 'Failed to save shift' },
      }));
    }
  };

  useEffect(() => {
    // Calculate expected on mount if opening balance changed
    calculateExpected();
  }, [shiftState.openingBalance]);

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
              <span className="font-medium text-lg text-gray-900">Cash Shifts</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Cash Shift Management</h1>

          {/* Open Shift */}
          {openShifts.length === 0 && (
            <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Open Cash Shift</h3>
              {isManager && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opening Balance (EGP)
                    </label>
                    <input
                      type="number"
                      value={shiftState.openingBalance}
                      onChange={(e) => handleOpeningBalance(Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    {shiftState.errors.openingBalance && (
                      <p className="mt-1 text-sm text-red-600">{shiftState.errors.openingBalance}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opening Date
                    </label>
                    <input
                      type="date"
                      value={shiftState.openingAt}
                      onChange={(e) => setShiftState(prev => ({ ...prev, openingAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (optional)
                    </label>
                    <textarea
                      value={shiftState.notes}
                      onChange={(e) =>
        setShiftState(prev => ({ ...prev, notes: e.target.value }))
      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                    >
                      Open Shift
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Currently Open Shifts */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Open Shifts</h3>
            {openShifts.length === 0 && (
              <p className="text-gray-500">No open shifts found.</p>
            )}
            {openShifts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Cashier</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Opening Balance</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Opening At</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Status</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openShifts.map((shift) => (
                      <tr key={shift.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{shift.cashier?.username || 'N/A'}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{shift.openingBalance / 100} EGP</p>
                        </td>
                        <td className="p-3">
                          <p className="text-xs text-gray-500">{shift.openingAt.toLocaleDateString()}</p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline px-2 py-1 text-xs rounded-md ${
                              shift.status === 'open'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            Open
                          </span>
                        </td>
                        <td className="p-3">
                          {isManager && (
                            <div className="flex gap-2">
                              <button
                                className="text-blue-600 hover underline text-xs"
                              >
                                Close Shift
                              </button>
                              <button
                                className="text-red-600 hover underline text-xs"
                              >
                                Reconcile Shift
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Closed Shifts History */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Shift History</h3>
            {closedShifts.length === 0 && (
              <p className="text-gray-500">No closed shifts found.</p>
            )}
            {closedShifts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Cashier</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Opening Bal.</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Closing Bal.</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Discrepancy</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Closing At</th>
                      <th className="p-3 text-left text-xs font-medium text-gray-600">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedShifts.map((shift) => (
                      <tr key={shift.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{shift.cashier?.username || 'N/A'}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{shift.openingBalance / 100} EGP</p>
                        </td>
                        <td className="p-3">
                          {shift.closingBalance !== null && shift.closingBalance !== undefined ? (
                            <p className="font-medium text-gray-900">{shift.closingBalance / 100} EGP</p>
                          ) : (
                            <p className="text-gray-500">Not counted</p>
                          )}
                        </td>
                        <td className="p-3">
                          {shift.discrepancy !== null && shift.discrepancy !== undefined ? (
                            <p className={shift.discrepancy === 0 ? 'text-green-600' : 'text-red-600'}>{shift.discrepancy / 100} EGP</p>
                          ) : (
                            <p className="text-gray-500">N/A</p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="text-xs text-gray-500">{shift.closingAt?.toLocaleDateString() || 'N/A'}</p>
                        </td>
                        <td className="p-3">
                          <p className="text-xs text-gray-500">{shift.closingAt && shift.openingAt ? Math.round((shift.closingAt.getTime() - shift.openingAt.getTime()) / 3600000) + ' hours' : 'N/A'}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}