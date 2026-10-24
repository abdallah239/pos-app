import { prisma } from '@/prisma';
import { z } from 'zod';
import { requireAuthenticatedUser, requireRole, requirePermission } from '@/permissions';
import { userSchema } from '@/validation';
import { getCurrentUser } from '@/session';

interface User {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

interface UserFormState {
  isEditing: boolean;
  userId?: string;
  username: string;
  role: string;
  isActive: boolean;
  errors: {
    username?: string;
    role?: string;
  };
  success: boolean;
  resetPassword: boolean;
}

export default async function UsersPage({
  request,
}: {
  request: Request;
}) {
  const { user } = await requireAuthenticatedUser(request);
  const isAdmin = user.role === 'ADMIN';

  // Check permission - only admins can access user management
  await requirePermission(request, 'users:view');

  // Handle form submission
  const [formState, setFormState] = React.useState<UserFormState>({
    isEditing: false,
    username: '',
    role: 'CASHIER',
    isActive: true,
    errors: {},
    success: false,
    resetPassword: false,
  });

  // Fetch users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = userSchema.parse({
        username: formState.username,
        role: formState.role,
        isActive: formState.isActive,
      });

      // Check for duplicate username
      if (!formState.isEditing && formState.userId) {
        // Editing - check if username changed and if it's already taken
        const existingUser = await prisma.user.findFirst({
          where: {
            username: validated.username,
            NOT: { id: formState.userId },
          },
        });

        if (existingUser) {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, username: 'Username already exists' },
          }));
          return;
        }
      } else if (!formState.isEditing) {
        // Creating new user
        const existingUser = await prisma.user.findFirst({
          where: { username: validated.username },
        });

        if (existingUser) {
          setFormState(prev => ({
            ...prev,
            errors: { ...prev.errors, username: 'Username already exists' },
          }));
          return;
        }
      }

      if (formState.isEditing && formState.userId) {
        // Reset password if requested
        let userData = {
          username: validated.username,
          role: validated.role,
          isActive: validated.isActive,
        };

        if (formState.resetPassword) {
          // Generate a temporary password
          const tempPassword = Math.random().toString(36).slice(-8);
          userData.passwordHash = await hashPassword(tempPassword);
        }

        await prisma.user.update({
          where: { id: formState.userId },
          data: userData,
        });
      } else {
        // Create new user - password will be hashed by the backend
        await prisma.user.create({
          data: {
            ...validated,
            passwordHash: await hashPassword('temporary123'), // Will be changed on first login
          },
        });
      }

      setFormState({
        ...formState,
        username: '',
        role: 'CASHIER',
        isActive: true,
        errors: {},
        success: true,
        resetPassword: false,
      });

      setTimeout(() => {
        setFormState({
          ...formState,
          success: false,
        });
      }, 3000);
    } catch (error: any) {
      if (error.errors) {
        const errors: UserFormState['errors'] = {};
        error.errors.forEach((e: any) => {
          errors[e.path as keyof UserFormState['errors']] = e.message;
        });
        setFormState(prev => ({ ...prev, errors }));
      } else {
        setFormState(prev => ({ ...prev, errors: { generic: error.message } }));
      }
    }
  };

  // Handle clear form
  const handleClear = () => {
    setFormState({
      isEditing: false,
      username: '',
      role: 'CASHIER',
      isActive: true,
      errors: {},
      success: false,
      resetPassword: false,
    });
  };

  // Handle edit
  const handleEdit = (user: User) => {
    setFormState({
      isEditing: true,
      userId: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      errors: {},
      success: false,
      resetPassword: false,
    });
  };

  // Handle deactivate/activate
  const handleToggleActive = async (userId: string, currentState: boolean) => {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !currentState },
    });
  };

  // Handle reset password
  const handleResetPassword = async (userId: string) => {
    const tempPassword = Math.random().toString(36).slice(-8);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(tempPassword) },
    });
    // In a real app, would send the temp password to the user via email
  };

  // Handle delete (soft delete - deactivate)
  const handleSoftDelete = async (userId: string) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
      // Invalidate user's sessions
      await prisma.session.deleteMany({
        where: { userId },
      });
    }
  };

  // Check if the current user is trying to deactivate themselves
  const isCurrentUser = (userId: string) => userId === formState.userId;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" d="M12 6v6l4 2-4 2v-6l-4-2 4-2z"></path>
                </svg>
              </div>
              <span className="font-medium text-lg text-gray-900">User Management</span>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  className="px-3 py-1 text-sm text-gray-600 rounded-md hover:bg-gray-100"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            User Management
          </h2>

          {isAdmin ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formState.username}
                  onChange={(e) =>
                    setFormState(prev => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  required
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={formState.isEditing}
                  autoComplete="username"
                />
                {formState.errors.username && (
                  <p className="mt-1 text-sm text-red-600">{formState.errors.username}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={formState.role}
                    onChange={(e) =>
                      setFormState(prev => ({
                        ...prev,
                        role: e.target.value,
                      }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={formState.isEditing}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="CASHIER">CASHIER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Status
                  </label>
                  <select
                    value={formState.isActive}
                    onChange={(e) =>
                      setFormState(prev => ({
                        ...prev,
                        isActive: e.target.value === 'true',
                      }))
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={formState.isEditing}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              {formState.isEditing && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reset Password
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState(prev => ({
                        ...prev,
                        resetPassword: !prev.resetPassword,
                      }))
                    }
                    className="w-full px-3 py-1 text-sm text-blue-600 rounded-md hover:bg-blue-100"
                  >
                    {formState.resetPassword ? 'Disable Reset' : 'Reset Password'}
                  </button>
                  {formState.resetPassword && (
                    <p className="mt-2 text-sm text-gray-500">
                      A temporary password will be generated and the user will need to
                      change it on next login.
                    </p>
                  )}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${formState.isEditing ? 'bg-green-600 text-green-100' : 'bg-blue-600 text-white'}`}
                >
                  {formState.isEditing ? 'Update User' : 'Create User'}
                </button>

                {formState.isEditing && (
                  <div className="ml-2 flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2 py-1 text-xs text-gray-600 rounded-md hover:bg-gray-100"
                    >
                      Clear
                    </button>
                    {formState.userId && (
                      <button
                        type="button"
                        onClick={() => handleSoftDelete(formState.userId!)}
                        className="px-2 py-1 text-xs text-red-600 rounded-md hover:bg-red-100"
                        disabled={isCurrentUser(formState.userId)}
                      >
                        {isCurrentUser(formState.userId!)
                          ? 'Cannot deactivate self'
                          : 'Deactivate'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </form>
          ) : (
            <p className="text-gray-500">
              Only administrators can access user management.
            </p>
          )}

          {/* Users table */}
          <div className="bg-white rounded-lg p-6 shadow-sm mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              All Users ({users.length})
            </h3>

            {users.length === 0 && (
              <p className="text-gray-500">
                No users found.
              </p>
            )}

            <table className="w-full min-w-max table-auto">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Username</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Role</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Status</th>
                  <th className="p-3 text-left text-xs font-medium text-gray-600">Created At</th>
                  {isAdmin && (
                    <th className="p-3 text-left text-xs font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="p-6 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium text-gray-900">{user.username}</p>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-md ${user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'MANAGER'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-md ${user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-gray-500">
                        {user.createdAt.toLocaleDateString()}
                      </p>
                    </td>
                    {isAdmin && (
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover underline text-xs"
                          >
                            Edit
                          </button>
                          {user.id !== (await getCurrentUser(request)).id && (
                            <>
                              <button
                                onClick={() => handleToggleActive(user.id, user.isActive)}
                                className="text-green-600 hover underline text-xs"
                                title={user.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {user.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleResetPassword(user.id)}
                                className="text-orange-600 hover underline text-xs"
                                title="Reset password"
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => handleSoftDelete(user.id)}
                                className="text-red-600 hover underline text-xs"
                                title="Delete user"
                                disabled={isCurrentUser(user.id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Warning about self-lockout */}
            {isAdmin && (
              <div className="mt-4 p-3 bg-yellow-50 border-y-2 border-yellow-300 rounded-md text-sm">
                <p className="text-yellow-800">
                  ⚠️ Note: Do not deactivate your own administrator account. Only an
                  authorized administrator can manage roles.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Helper function to hash passwords */
async function hashPassword(password: string): Promise<string> {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}

/** Helper function to get current user ID from request */
function getCurrentUserRequest(request: Request): string {
  const { user } = getCurrentUser(request);
  return user?.id || '';
}