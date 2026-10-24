import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  log: ['error'],
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer: string) => {
      resolve(answer);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('=== POS System: Initial Admin Account Setup ===\n');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('An administrator account already exists.');
    const overwrite = await askQuestion(
      'Do you want to overwrite it? (y/n): '
    );

    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled. Existing admin account preserved.');
      rl.close();
      return;
    }

    // Delete existing admin and all associated data
    await prisma.session.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.user.delete({
      where: { id: existingAdmin.id },
    });
    console.log('Existing admin account and associated data removed.\n');
  }

  // Get username
  const username = await askQuestion('Enter desired username: ');

  // Check if username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    console.error(`Username '${username}' already exists. Setup aborted.`);
    rl.close();
    return;
  }

  // Get password
  const password = await askQuestion('Enter desired password: ');

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`\n✅ Administrator account created successfully!`);
  console.log(`   Username: ${adminUser.username}`);
  console.log(`   Role: ${adminUser.role}`);
  console.log(`   Status: ${adminUser.isActive ? 'Active' : 'Inactive'}`);
  console.log(`
⚠️  SECURITY NOTES:
- Change the default password after first login
- Store this password securely - it will not be displayed again
- Only use this account for initial setup
- Consider creating additional administrator accounts as needed
- `);

  rl.close();
}

main()
  .catch((e) => {
    console.error('Error during setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });