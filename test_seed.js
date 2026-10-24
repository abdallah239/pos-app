const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('An administrator account already exists.');
    console.log('Username:', existingAdmin.username);
    console.log('Role:', existingAdmin.role);
    await prisma.$disconnect();
    return;
  }

  // Create admin user with hardcoded credentials
  const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Administrator account created successfully!');
  console.log('Username: admin');
  console.log('Password: admin123 (SHA-256 hashed)');
  console.log('Role: ADMIN');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });