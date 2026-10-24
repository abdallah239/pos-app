import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

export { prisma };

/**
 * Check if a user has permission to access a resource
 * @param userId - The user's ID
 * @param permission - The permission string to check (e.g., 'products:view', 'products:create')
 * @returns {Promise<boolean>} Whether the user has the permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { products: true },
  });

  if (!user) {
    return false;
  }

  // Role-based permission checking
  const permissions = getPermissionsForRole(user.role);

  return permissions.includes(permission);
}

/**
 * Get permissions based on user role
 * @param role - The user's role
 * @returns {string[]} Array of permission strings
 */
function getPermissionsForRole(role: string): string[] {
  const permissions: Record<string, string[]> = {
    ADMIN: [
      'products:create',
      'products:view',
      'products:edit',
      'products:delete',
      'users:view',
      'users:create',
      'users:edit',
      'users:delete',
      'cashier:view',
      'dashboard:view',
    ],
    MANAGER: [
      'products:create',
      'products:view',
      'dashboard:view',
    ],
    CASHIER: [
      'cashier:view',
      'dashboard:view',
    ],
  };

  return permissions[role] || [];
}

/**
 * Get the current user's role from the session
 * @param request - The HTTP request object
 * @returns {Promise<string | null>} The user's role, or null if not authenticated
 */
export async function getUserRole(request: Request): Promise<string | null> {
  const { user } = await getCurrentUser(request);

  if (!user) {
    return null;
  }

  return user.role;
}

/**
 * Require authentication and a specific permission
 * @param request - The HTTP request object
 * @param permission - The permission string required
 * @throws {Error} 401 Unauthorized if not authenticated
 * @throws {Error} 403 Forbidden if user doesn't have the required permission
 */
export async function requirePermission(request: Request, permission: string): Promise<any> {
  const user = await requireAuthenticatedUser(request);

  const hasPerm = await hasPermission(user.id, permission);

  if (!hasPerm) {
    const error: Error & { status?: number } = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  return user;
}

/**
 * Require authentication
 * @param request - The HTTP request object
 * @throws {Error} 401 Unauthorized if not authenticated
 */
export async function requireAuthenticatedUser(request: Request): Promise<any> {
  const { user } = await getCurrentUser(request);

  if (!user) {
    const error: Error & { status?: number } = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  return user;
}