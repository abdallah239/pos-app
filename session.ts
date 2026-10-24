import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

export { prisma };

/**
 * Create a new session for a user
 * @param userId - The user's ID
 * @param expiresAt - When the session expires
 * @returns {Promise<{ session: any; token: string }>} The created session and raw token
 */
export async function createSession(userId: string, expiresAt: Date): Promise<{ session: any; token: string }> {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const session = await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return { session, token };
}

/**
 * Find a session by its token hash
 * @param tokenHash - The hashed session token
 * @returns {Promise<any | null>} The session if found, null otherwise
 */
export async function findSessionByTokenHash(tokenHash: string): Promise<any | null> {
  return prisma.session.findFirst({
    where: { tokenHash },
    include: { user: true },
  });
}

/**
 * Invalidate a session
 * @param sessionId - The session ID to invalidate
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  });
}

/**
 * Get the current user from the session cookie
 * @param request - The HTTP request object
 * @returns {Promise<{ user: any | null; session: any | null }>} The user and session
 */
export async function getCurrentUser(request: Request): Promise<{ user: any | null; session: any | null }> {
  const cookie = request.cookies.get('session')?.value;

  if (!cookie) {
    return { user: null, session: null };
  }

  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(cookie).digest('hex');

  const session = await prisma.session.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return { user: null, session: null };
  }

  if (!session.user.isActive) {
    return { user: null, session: null };
  }

  return { user: session.user, session };
}

/**
 * Invalidate all sessions for a user
 * @param userId - The user's ID
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Rotate a session token (create new session, invalidate old one)
 * @param request - The HTTP request object
 * @param newExpiresAt - New expiration date
 * @returns {Promise<{ newSession: any; newToken: string }>} The new session and token
 */
export async function rotateSession(request: Request, newExpiresAt?: Date): Promise<{ newSession: any; newToken: string }> {
  const { session, user } = await getCurrentUser(request);

  if (!session || !user) {
    const error: Error & { status?: number } = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  // Invalidate the current session
  await invalidateSession(session.id);

  // Create a new session
  const expiresAt = newExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
  const result = await createSession(user.id, expiresAt);

  return { newSession: result.session, newToken: result.token };
}