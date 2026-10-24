const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['error'] });

async function test() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' },
  });
  
  if (existingAdmin) {
    console.log('Existing admin found:', existingAdmin.username, existingAdmin.role);
    
    // Verify password
    const inputHash = crypto.createHash('sha256').update('admin123').digest('hex');
    const passwordValid = inputHash === existingAdmin.passwordHash;
    console.log('Password matches admin123:', passwordValid);
    
    // Test with wrong password
    const wrongHash = crypto.createHash('sha256').update('wrong').digest('hex');
    const wrongValid = wrongHash === existingAdmin.passwordHash;
    console.log('Password matches "wrong":', wrongValid);
    
    // Check isActive
    console.log('isActive:', existingAdmin.isActive);
  } else {
    console.log('Admin user not found');
    
    // Create admin user
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
    
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });
    
    console.log('User created:', user.username, user.role);
  }
  
  await prisma.$disconnect();
}

test().then(() => console.log('\nDone')).catch(e => console.error('Error:', e));