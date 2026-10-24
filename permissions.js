// Prisma permissions for Next.js

let prisma;

if (typeof window === 'undefined') {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
  module.exports = prisma;
} else {
  module.exports = {
    hasPermission: async () => false,
    getPermissionsForRole: (role) => [],
    getUserRole: () => null,
    requirePermission: async () => { throw new Error('Unauthorized'); },
    requireAuthenticatedUser: async () => { throw new Error('Unauthorized'); },
  };
}