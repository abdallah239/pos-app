# Startup Guide for POS Application

## Prerequisites
- Node.js v18 or later
- npm v9 or later
- Git (for cloning)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pos-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file:
   ```
   DATABASE_URL="file:./dev.db"
   BCRYPT_SALT_ROUNDS=12
   SESSION_SECRET=change-this-to-a-secure-random-value
   SESSION_EXPIRES_DAYS=30
   NODE_ENV=development
   APP_URL=http://localhost:3000
   ```

4. **Database initialization**
   ```bash
   npx prisma migrate dev --name init_schema --create-only
   npx prisma generate
   node prisma/seed.js
   ```
   
   **Seed script**: When prompted, enter:
   - `n` to keep existing admin (or provide new credentials)
   - Username: `admin`
   - Password: `admin123`

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   ```
   http://localhost:3000
   ```

## Default Admin Account
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: ADMIN

## Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run seed` - Re-run admin account setup

## Database Models
The application uses Prisma ORM with SQLite. Key models include:
- User, Session (authentication)
- Category, Product (inventory)
- Supplier, PurchaseInvoice (purchasing)
- Customer, Sale (sales)
- CashShift, CashMovement (cash register)
- ExpenseCategory, Expense (expenses)
- AuditLog (audit trail)
- StoreSettings (configuration)

## Troubleshooting

### Common Issues

1. **TypeScript errors** (TS5107 deprecation)
   - This is expected with TypeScript 7.0+
   - Can be silenced by adding `ignoreDeprecations: "6.0"` to tsconfig.json
   
2. **Prisma client generation**
   - Run: `npx prisma generate`
   - Ensure `node_modules/@prisma/client` exists

3. **Database locked errors**
   - Close any other processes using `dev.db`
   - Or run: `npx prisma migrate reset`

4. **Module not found errors for `@/` imports**
   - Ensure `tsconfig.json` has proper `baseUrl` and `paths`
   - Ensure `next.config.js` webpack alias is configured
   - Ensure `jsconfig.json` exists at project root

5. **Seed script interactive prompt issues**
   - The seed.js was rewritten to use console-based input
   - Uses `process.stdin.once('data')` instead of readline

### Production Deployment
```bash
npm run build
npm run start
```
Set `NODE_ENV=production` and `SESSION_SECRET` to a secure random value.

## Project Structure
```
pos-app/
├── app/              # Next.js 14 App Router pages
│   ├── dashboard/    # Dashboard with metrics
│   ├── cashier/      # POS checkout
│   ├── products/     # Product management
│   ├── suppliers/    # Supplier management
│   ├── customers/    # Customer accounts
│   ├── returns/      # Returns & refunds
│   └── shifts/       # Cash shift management
├── prisma/           # Prisma ORM schema & migrations
├── api/              # API routes
├── components/       # UI components
├── lib/              # Utility libraries
└── public/           # Static assets
```