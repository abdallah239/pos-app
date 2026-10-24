const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({
  log: ['error'],
});

async function main() {
  console.log('=== POS System: Initial Admin Account Setup ===\n');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('An administrator account already exists.');
    const overwrite = await new Promise((resolve) => {
      process.stdout.write('Do you want to overwrite it? (y/n): ');
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });

    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled. Existing admin account preserved.');
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
  const username = await new Promise((resolve) => {
    process.stdout.write('Enter desired username: ');
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  // Check if username already exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    console.error(`Username '${username}' already exists. Setup aborted.`);
    return;
  }

  // Get password
  const password = await new Promise((resolve) => {
    process.stdout.write('Enter desired password: ');
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  // Hash password
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('\n✅ Administrator account created successfully!');
  console.log('   Username: ' + adminUser.username);
  console.log('   Role: ' + adminUser.role);
  console.log('   Status: ' + (adminUser.isActive ? 'Active' : 'Inactive'));
  console.log(
    '\u26A0\uFE0F  SECURITY NOTES:\n' +
      '- Change the default password after first login\n' +
      '- Store this password securely - it will not be displayed again\n' +
      '- Only use this account for initial setup\n' +
      '- Consider creating additional administrator accounts as needed\n'
  );
}

main()
  .catch((e) => {
    console.error('Error during setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });