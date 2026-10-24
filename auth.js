// Prisma client initialization for Next.js
// This file should be imported server-side only

let prisma;

if (typeof window === 'undefined') {
  // Server side - lazy init to avoid creating multiple clients
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
  module.exports = prisma;
} else {
  // Client side - export a mock or empty object
  module.exports = {
    user: { findFirst: () => Promise.resolve({}) },
    product: { findMany: () => Promise.resolve([]) },
    session: { findFirst: () => Promise.resolve({}) },
    // ... other models
    $transaction: async () => {},
    $executeRaw: async () => {},
    $queryRaw: async () => {},
  };
}