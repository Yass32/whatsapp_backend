const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');

    await prisma.$connect();
    console.log('✅ Database connection successful');

    const adminCount = await prisma.admin.count();
    console.log('✅ Admin count:', adminCount);

    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

module.exports = testConnection;
