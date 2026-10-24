import { z } from 'zod';
import { verifyCredentials, generateSessionToken, createSession, hashSessionToken } from '@/auth';
import { requireAuthenticatedUser } from '@/permissions';
import { prisma } from '@/prisma';
import { redirect } from 'next/navigation';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

interface LoginFormErrors {
  username?: string;
  password?: string;
  generic?: string;
}

export default async function LoginPage({
  request,
}: {
  request: Request;
}) {
  const method = request.method;

  if (method === 'POST') {
    try {
      const body = await request.formData();
      const data = {
        username: body.get('username'),
        password: body.get('password'),
      };

      const validated = loginSchema.parse(data);

      const { user, valid, inactive } = await verifyCredentials(
        validated.username,
        validated.password
      );

      if (!valid) {
        // Generic error to prevent username enumeration
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-lg">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Login</h2>
              <form className="space-y-4" onSubmit={/* prevented by default */}>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                    defaultValue={validated.username}
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                  )}

                  <p className="mt-2 text-sm text-gray-500">
                    Enter your username
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}

                  <p className="mt-2 text-sm text-gray-500">
                    Enter your password
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Login
                </button>
              </form>
            </div>
          </div>
        )
      }

      if (inactive) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-lg">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Login</h2>
              <p className="text-red-600 mb-4">Your account is inactive. Please contact an administrator.</p>
              <button
                onClick={() => window.history.back()}
                className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Go Back
              </button>
            </div>
          </div>
        )
      }

      // Create session and set cookie
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const { session, token } = await createSession(user.id, expiresAt);

      // Set HTTP-only cookie
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      };

      // @ts-ignore - next/cookies API
      request.cookies.set('session', token, cookieOpts);

      // Redirect based on role
      if (user.role === 'ADMIN' || user.role === 'MANAGER') {
        redirect('/dashboard');
      } else if (user.role === 'CASHIER') {
        redirect('/cashier');
      }
    } catch (error) {
      // Generic error message - don't reveal if login failed
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Login</h2>
            <p className="text-red-600 mb-4">Invalid credentials. Please try again.</p>
            <button
              onClick={() => window.history.back()}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Go Back
            </button>
          </div>
        </div>
      )
    }
  }

  // GET request - show login form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Login</h2>
        <form className="space-y-6" method="post">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              name="username"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}