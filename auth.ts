import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

export { prisma };

/**
 * Verify user credentials
 * @param username - The username to check
 * @param password - The plaintext password to verify
 * @returns {Promise<{ user: any; valid: boolean }>} The user if credentials are valid, null otherwise
 */
export async function verifyCredentials(username: string, password: string): Promise<{ user: any; valid: boolean }> {
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    return { user: null, valid: false };
  }

  if (!user.isActive) {
    return { user: null, valid: false, inactive: true };
  }

  // Verify password using bcrypt
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    return { user: null, valid: false };
  }

  return { user, valid: true };
}

/**
 * Generate a cryptographically secure session token
 * @returns {string} A random session token string
 */
export function generateSessionToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Hash a session token for storage in the database
 * @param token - The raw session token
 * @returns {Promise<string>} The hashed token
 */
export async function hashSessionToken(token: string): Promise<string> {
  return require('crypto').createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session for a user
 * @param userId - The user's ID
 * @param expiresAt - When the session expires
 * @returns {Promise<Session>} The created session
 */
export async function createSession(userId: string, expiresAt: Date): Promise<any> {
  const token = generateSessionToken();
  const tokenHash = await hashSessionToken(token);

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
 * @returns {Promise<Session | null>} The session if found, null otherwise
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
 * Get the current user from the session
 * @param request - The HTTP request object
 * @returns {Promise<{ user: any | null; session: any | null }>} The user and session
 */
export async function getCurrentUser(request: Request): Promise<{ user: any | null; session: any | null }> {
  const cookie = request.cookies.get('session')?.value;

  if (!cookie) {
    return { user: null, session: null };
  }

  const tokenHash = await hashSessionToken(cookie);

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
 * Require authentication - throw 401 if not authenticated
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

/**
 * Require a specific role
 * @param request - The HTTP request object
 * @param allowedRoles - Array of allowed role strings
 * @throws {Error} 403 Forbidden if user doesn't have the required role
 */
export async function requireRole(request: Request, allowedRoles: string[]): Promise<any> {
  const user = await requireAuthenticatedUser(request);

  if (!allowedRoles.includes(user.role)) {
    const error: Error & { status?: number } = new Error('Forbidden');
    error.status = 403;
    throw error;
  }

  return user;
}