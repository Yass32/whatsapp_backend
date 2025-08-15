const { PrismaClient } = require('../generated/prisma');
const cron = require('node-cron');

const prisma = new PrismaClient();

/**
 * Clean up expired MessageContext records
 * @param {number} olderThanHours - Delete records older than X hours (default: 184)
 * @returns {Object} Cleanup result with count of deleted records
 */
const cleanupExpiredMessageContexts = async (olderThanHours = 184) => {
  try {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    console.log(`🧹 Starting cleanup of MessageContext records older than ${olderThanHours} hours...`);
    console.log(`🕒 Cutoff time: ${cutoffTime.toISOString()}`);
    
    // Delete expired message contexts
    const result = await prisma.messageContext.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // Records past their expiry date
          { createdAt: { lt: cutoffTime } }   // Records older than specified hours
        ]
      }
    });
    
    console.log(`✅ Cleanup completed: ${result.count} MessageContext records deleted`);
    
    return {
      success: true,
      deletedCount: result.count,
      cutoffTime: cutoffTime.toISOString(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error during MessageContext cleanup:', error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Clean up old Message records (optional)
 * @param {number} olderThanDays - Delete records older than X days (default: 30)
 */
const cleanupOldMessages = async (olderThanDays = 30) => {
  try {
    const cutoffTime = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    
    console.log(`🧹 Starting cleanup of Message records older than ${olderThanDays} days...`);
    
    const result = await prisma.message.deleteMany({
      where: {
        createdAt: { lt: cutoffTime }
      }
    });
    
    console.log(`✅ Message cleanup completed: ${result.count} records deleted`);
    
    return {
      success: true,
      deletedCount: result.count,
      cutoffTime: cutoffTime.toISOString()
    };
  } catch (error) {
    console.error('❌ Error during Message cleanup:', error);
    return { success: false, error: error.message, deletedCount: 0 };
  }
};

/**
 * Schedule automatic cleanup to run daily at 2 AM
 */
const scheduleAutomaticCleanup = () => {
  // Run cleanup daily at 2:00 AM
  cron.schedule('0 10 * * 1', async () => {
    console.log('🕐 Running scheduled cleanup at 10:00 AM...');
    
    // Clean up MessageContexts older than 184 hours
    await cleanupExpiredMessageContexts(184);
    
    // Clean up Messages older than 30 days (optional)
    await cleanupOldMessages(30);
    
    console.log('✅ Scheduled cleanup completed');
  }, {
    timezone: "Europe/Istanbul" // Match your app's timezone
  });
  
  console.log('📅 Automatic cleanup scheduled: Weekly at 10:00 AM (Europe/Istanbul)');
};

/**
 * Run cleanup immediately (for manual execution)
 */
const runCleanupNow = async () => {
  console.log('🚀 Running manual cleanup...');
  
  const contextResult = await cleanupExpiredMessageContexts(184);
  const messageResult = await cleanupOldMessages(30);
  
  return {
    messageContexts: contextResult,
    messages: messageResult,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  cleanupExpiredMessageContexts,
  cleanupOldMessages,
  scheduleAutomaticCleanup,
  runCleanupNow
};
