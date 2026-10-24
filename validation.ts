import { z } from 'zod';

/**
 * Zod schema for user login credentials
 */
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

/**
 * Zod schema for product creation
 */
export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Product name too long'),
  price: z
    .number()
    .int('Price must be an integer (cents)')
    .min(0, 'Price must be non-negative'),
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU too long'),
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
});

/**
 * Zod schema for product update
 */
export const productUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(100, 'Product name too long')
    .optional(),
  price: z
    .number()
    .int('Price must be an integer (cents)')
    .min(0, 'Price must be non-negative')
    .optional(),
  sku: z.string().max(50, 'SKU too long').optional(),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(50, 'Category too long')
    .optional(),
});

/**
 * Zod schema for user creation/editing
 */
export const userSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER']),
  isActive: z.boolean().default(true),
});

/**
 * Zod schema for password reset
 */
export const passwordResetSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Parse login data with validation
 * @param data - The raw form data
 * @returns {Promise<z.infer<typeof loginSchema>>} The validated data
 * @throws {Error} If validation fails
 */
export async function validateLogin(data: unknown) {
  return loginSchema.parse(data);
}

/**
 * Parse product data with validation
 * @param data - The raw form data
 * @returns {Promise<z.infer<typeof productSchema>>} The validated data
 * @throws {Error} If validation fails
 */
export async function validateProduct(data: unknown) {
  return productSchema.parse(data);
}

/**
 * Parse product update data with validation
 * @param data - The raw form data
 * @returns {Promise<z.infer<typeof productUpdateSchema>>} The validated data
 * @throws {Error} If validation fails
 */
export async function validateProductUpdate(data: unknown) {
  return productUpdateSchema.parse(data);
}

/**
 * Parse user data with validation
 * @param data - The raw form data
 * @returns {Promise<z.infer<typeof userSchema>>} The validated data
 * @throws {Error} If validation fails
 */
export async function validateUser(data: unknown) {
  return userSchema.parse(data);
}

/**
 * Parse password reset data with validation
 * @param data - The raw form data
 * @returns {Promise<z.infer<typeof passwordResetSchema>>} The validated data
 * @throws {Error} If validation fails
 */
export async function validatePasswordReset(data: unknown) {
  return passwordResetSchema.parse(data);
}