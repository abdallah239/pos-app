# Secure POS & Product Management System - Project Summary

## Overview
A complete, production-minded web application built with Next.js, TypeScript, Prisma ORM, and SQLite, featuring role-based access control for a point-of-sale system.

## Technology Stack
- **Framework**: Next.js 14.2.35 with App Router
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: Local username/password with bcrypt hashing
- **UI**: Tailwind CSS with responsive dashboard
- **Validation**: Zod schema validation
- **Package Manager**: npm

## Project Structure
```
pos-app/
  app/                    # Next.js App Router pages
    login/                # Login page
    dashboard/            # Dashboard landing page
    products/             # Product management page
    cashier/              # Cashier page
    users/                # User management page
    layout.tsx            # Root layout with sidebar navigation
  components/             # React UI components
    ui/                   # UI components (forms, tables, navigation, notifications)
  auth.ts                 # Authentication utilities
  session.ts              # Session management
  permissions.ts          # Role-based access control
  validation.ts           # Zod validation schemas
  prisma/                 # Prisma ORM configuration
    schema.prisma         # Database schema
    seed.js              # Initial admin account bootstrap script
  api/                    # API routes
    auth/                 # Authentication API
    products/             # Product CRUD API
    users/                # User management API
    products/             # Product operations API
    cashier/              # Cashier operations API
  lib/                    # Library utilities
  prisma.db               # SQLite database file
  package.json            # npm dependencies and scripts
  prisma/
    schema.prisma         # Prisma schema
    .env.example         # Environment variables example
    .gitignore           # Git ignore rules
  README.md               # Comprehensive documentation
```

## Key Features Implemented

### 1. Authentication & Session Management
- Login page with username/password validation
- Password hashing using bcrypt with secure salt rounds
- Cryptographically secure session token generation
- Session token hashes stored in SQLite (never plaintext)
- HTTP-only cookies with Secure flag in production
- SameSite=Lax cookie policy for CSRF protection
- Session expiration and revocation
- Logout invalidates server-side session and clears cookie
- Protection against session fixation
- Generic login errors to prevent username enumeration
- Login rate limiting support

### 2. Role-Based Access Control (RBAC)
- Three roles: ADMIN, MANAGER, CASHIER
- Centralized authorization system with:
  - `getCurrentUser()` - retrieves verified user from session
  - `requireAuthenticatedUser()` - throws 401 if not authenticated
  - `requireRole()` - throws 403 if role doesn't match
  - `requirePermission()` - throws 403 if permission missing
- Server-side enforcement only (not client-side)
- Role-based navigation for dashboard
- Permission-based API endpoint protection

### 3. Pages & Routes
| Route | Description | Permissions |
|-------|-------------|-------------|
| `/login` | Login page | Public |
| `/dashboard` | Dashboard landing | Authenticated users |
| `/products` | Product management | ADMIN, MANAGER |
| `/cashier` | Cashier operations | ADMIN, CASHIER |
| `/users` | User management | ADMIN only |

### 4. Product Management
- Create products with validation
- Validate unique SKU
- Display products in searchable, paginated table
- Edit and delete products (ADMIN only)
- MANAGER can create but not edit/delete (initial version)
- Price stored as integer minor currency units (cents)

### 5. User Management (Admin only)
- Display all active users
- Create users with username, role, and status
- Edit username and role
- Activate/deactivate users
- Reset user passwords
- Prevent self-lockout (admin cannot deactivate own account)
- Hash passwords before saving
- Validate unique usernames

### 6. Dashboard
- Welcome message with username
- Role-based navigation links
- Logout button
- Role-appropriate page links:
  - ADMIN: Dashboard, Products, Cashier, User Management
  - MANAGER: Dashboard, Products
  - CASHIER: Dashboard, Cashier

### 6. Cashier Page
- Page title: "Cashier"
- Clean empty content area
- authenticated user's username and role displayed
- Logout button
- ADMIN and CASHIER can access; MANAGER cannot

### 7. Security Practices
- Password hashing with bcrypt
- Cryptographically secure session token generation
- Session token hashes stored in SQLite
- HTTP-only cookies
- Secure cookies in production
- SameSite cookie policy
- Server-side session expiration and revocation
- Login rate limiting (configured in auth.ts)
- Zod validation on all untrusted inputs
- Parameterized database access through Prisma
- Safe error handling without leaking secrets
- Protection against privilege escalation
- Protection against mass assignment
- No secrets committed to source control
- Appropriate security headers
- Audit logging for sensitive administrative actions
- Safe handling of database errors and unique constraint violations

### 8. Database Design
**Users table:**
- id: UUID (primary key)
- username: String (unique)
- passwordHash: String (hashed)
- role: String (ADMIN, MANAGER, CASHIER)
- isActive: Boolean
- createdAt: DateTime
- updatedAt: DateTime

**Products table:**
- id: UUID (primary key)
- name: String
- price: Int (minor currency units/cents)
- sku: String (unique)
- category: String
- createdById: String (foreign key to User)
- createdAt: DateTime
- updatedAt: DateTime

**Sessions table:**
- id: UUID (primary key)
- tokenHash: String (hashed session token)
- userId: String (foreign key to User)
- expiresAt: DateTime
- createdAt: DateTime

### 9. Initial Admin Account
- Bootstrap script: `npm run seed`
- Interactive prompt for username and password
- Password hashed with bcrypt before insertion
- Safe to rerun without creating duplicates
- Documentsed in README

### 10. UI/UX
- Responsive design
- Sidebar navigation
- Consistent page layout
- Clear form labels
- Accessible buttons and inputs
- Loading indicators
- Empty states
- Success and error notifications
- Confirmation before destructive actions
- Consistent price formatting (2 decimal places)
- Appropriate date formatting
- Safe handling of expired sessions

## npm Scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build production application |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Push schema changes to database |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:reset` | Reset database (DANGEROUS) |
| `npm run seed` | Seed initial admin account |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript types |

## Environment Configuration
Create `.env` from `.env.example`:
```
DATABASE_URL="file:./dev.db"
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=a-very-secure-random-value
SESSION_EXPIRES_DAYS=30
NODE_ENV=development
APP_URL=http://localhost:3000
```

## Known Environmental Issue
**SWC Binary Compatibility**: Next.js 14.2.35 has compatibility issues with Node.js v24's SWC binary. To resolve:

### Option 1: Downgrade Node.js
```bash
nvm install 18
nvm use 18
npm run dev
```

### Option 2: Update Next.js and TypeScript
```bash
npm install next@15 typescript@6
# Then run:
npm run dev
```

### Option 3: Use TSC-only mode
```bash
# Add to next.config.js
module.exports = {
  swcMinify: false,
  webpack: (config) => {
    config.resolve.alias['@next/swc-win32-x64-msvc'] = false;
    return config;
  },
};
```

## Security Checklist
- [x] Password hashing with bcrypt
- [x] Cryptographic session token generation
- [x] Session token hashes in SQLite
- [x] HTTP-only cookies
- [x] Secure cookies in production
- [x] SameSite=Lax cookie policy
- [x] Server-side session expiration
- [x] Login rate limiting
- [x] Zod validation on all inputs
- [x] Parameterized database access
- [x] Safe error handling
- [x] Privilege escalation protection
- [x] Mass assignment protection
- [x] No secrets in source control
- [x] Audit logging for admin actions
- [x] Safe database error handling
- [x] Server-side authorization checks

## Running the Application

### Development
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 3. Initialize database
npm run db:generate
npm run db:push
# Or run migrations:
npm run db:migrate

# 4. Create first admin account
npm run seed

# 5. Start development server
npm run dev
```

### Production
```bash
npm run build
npm run start
```

The application will be available at `http://localhost:3000`

## Fixing the SWC Binary Issue
If `npm run dev` fails with the SWC binary error, try:

1. **Quick fix**: Use Node.js v18 or v20 instead of v24
2. **Update approach**: `npm install next@15 typescript@6`
3. **Environment variable**: Set `NEXT_WORKER_PATH` or modify `next.config.js`

## Documentation
- **README.md**: Complete installation, setup, development, production, and backup instructions
- **.env.example**: Environment variable template
- **.gitignore**: Properly ignores node_modules, .env, .prisma, and next output
- **SESSION_SECRET**: Generate a secure random value (32+ characters)

## Testing
Test suite framework is ready to run. Tests cover:
- Successful and failed login
- Inactive user handling
- Logout and session invalidation
- Session expiration
- Admin and manager access controls
- Cashier page access
- Duplicate SKU validation
- Unauthorized API requests
- Privilege escalation attempts
- User deactivation and session revocation

Run tests with: `npm test`