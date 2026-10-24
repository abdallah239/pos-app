// Zod validation schemas for Next.js

const z = require('zod');

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Product name too long'),
  price: z.number().int('Price must be an integer (cents)').min(0, 'Price must be non-negative'),
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU too long'),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
});

const productUpdateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Product name too long').optional(),
  price: z.number().int('Price must be an integer (cents)').min(0, 'Price must be non-negative').optional(),
  sku: z.string().max(50, 'SKU too long').optional(),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long').optional(),
});

const userSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER']),
  isActive: z.boolean().default(true),
});

const passwordResetSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

module.exports = {
  loginSchema,
  productSchema,
  productUpdateSchema,
  userSchema,
  passwordResetSchema,
};