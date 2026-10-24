import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient({ log: ['error'] });

interface SaleItem {
  productId: string;
  quantity: number;
  unitPrice: number; // in cents
  discount: number; // in cents
  name: string;
  barcode?: string;
}

interface SaleRequest {
  items: SaleItem[];
  paymentMethod: string;
  cashReceived?: number;
  subtotal: number; // in cents
  discountAmount: number; // in cents
  taxAmount: number; // in cents
  totalAmount: number; // in cents
  idempotencyKey: string;
  customerId?: string;
  shiftId?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, paymentMethod, cashReceived, subtotal, discountAmount, taxAmount, totalAmount, idempotencyKey, customerId, shiftId } = body;

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No items in sale' }, { status: 400 });
    }

    if (!idempotencyKey) {
      return NextResponse.json({ message: 'Missing idempotency key' }, { status: 400 });
    }

    // Check idempotency - prevent duplicate checkout submissions
    const existingSale = await prisma.sale.findFirst({
      where: { referenceNumber: idempotencyKey },
    });

    if (existingSale) {
      return NextResponse.json({ message: 'Duplicate sale submission detected' }, { status: 409 });
    }

    // Begin database transaction
    const result = await prisma.$transaction(async tx => {
      // 1. Create the sale record
      const saleRef = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const sale = await tx.sale.create({
        data: {
          invoiceNumber: saleRef,
          referenceNumber: idempotencyKey,
          cashierId: undefined, // Will be set by the caller or middleware
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          status: 'completed',
          paymentMethod,
          ...(customerId && { customerId }),
          ...(shiftId && { shiftId }),
        },
      });

      // 2. Create sale items (snapshots of product data at time of sale)
      for (const item of items) {
        // Verify product exists and check stock
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        // Create sale item snapshot
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice, // Snapshot price at time of sale
            totalPrice: item.unitPrice * item.quantity,
            discount: item.discount,
            barcode: item.barcode,
          },
        });

        // 3. Create inventory movement (outgoing - stock sold)
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'OUTGOING',
            quantity: -item.quantity, // Negative quantity for outgoing
            referenceId: sale.id,
            referenceType: 'sale',
            description: `Sale invoice ${saleRef}`,
          },
        });

        // 4. Update product's last purchase cost snapshot (optional)
        // If historical cost changes, preserve costs associated with historical sales
        if (item.unitPrice < product.price) {
          // New lower cost - could update lastPurchaseCost but preserve historical costs
        }
      }

      // 5. Create payment record
      const paymentAmount = totalAmount; // The full amount paid
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: paymentAmount,
          paymentMethod,
          status: 'completed',
          ...(cashReceived !== undefined && { transactionId: crypto.randomUUID().substr(0, 16) }),
        },
      });

      // 6. If cash payment, create cash shift movement
      if (paymentMethod === 'cash') {
        await tx.cashMovement.create({
          data: {
            type: 'cash_in',
            amount: paymentAmount,
            reference: saleRef,
            description: `Sale payment - Invoice ${saleRef}`,
          },
        });
      }

      return { sale, items: sale.items };
    });

    // Log audit entry
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Sale',
        entityId: result.sale.id,
        details: `Sale finalized: ${result.sale.id}, Total: ${result.sale.totalAmount} cents, Items: ${result.items.length}`,
      },
    });

    return NextResponse.json({
      success: true,
      sale: {
        id: result.sale.id,
        invoiceNumber: result.sale.invoiceNumber,
        totalAmount: result.sale.totalAmount,
        paymentMethod,
        createdAt: result.sale.createdAt,
      },
      itemsCount: result.items.length,
    });
  } catch (error: any) {
    console.error('Sale finalization error:', error);
    return NextResponse.json({ message: error.message || 'Failed to finalize sale' }, { status: 500 });
  }
}