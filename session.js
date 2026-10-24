// Prisma session management for Next.js

let prisma;

if (typeof window === 'undefined') {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
  module.exports = prisma;
} else {
  module.exports = {
    user: { findFirst: () => Promise.resolve({}) },
    session: { findFirst: () => Promise.resolve({}) },
    $transaction: async () => {},
    $executeRaw: async () => {},
    $queryRaw: async () => {},
  };
}