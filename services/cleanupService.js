/**
 * Cleanup Service - Database Maintenance
 * 
 * This service handles automated cleanup of old and expired data:
 * - Expired message contexts that are no longer needed for reply tracking
 * - Old message records to prevent database bloat
 * - Scheduled cleanup tasks using cron jobs
 * - Manual cleanup execution for maintenance
 */

const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron'); // For scheduling automated cleanup tasks

// Initialize Prisma client for database operations
const prisma = new PrismaClient();

/**
 * Clean up expired MessageContext records
 * 
 * MessageContext records are used to track replies to WhatsApp messages.
 * They become stale after a certain time and should be cleaned up to:
 * - Prevent database bloat
 * - Remove outdated context that could cause confusion
 * - Maintain optimal database performance
 * 
 * Cleanup criteria:
 * - Records past their explicit expiry date (expiresAt field)
 * - Records older than specified hours (fallback cleanup)
 * 
 * @param {number} olderThanHours - Delete records older than X hours (default: 184 = ~7.7 days)
 * @returns {Object} Cleanup result with success status and deletion count
 */
const cleanupExpiredMessageContexts = async (olderThanHours = 184) => {
    try {
        // Calculate cutoff time based on hours parameter
        const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
        
        console.log(`🧹 Starting cleanup of MessageContext records older than ${olderThanHours} hours...`);
        console.log(`🕒 Cutoff time: ${cutoffTime.toISOString()}`);
        
        // Delete expired message contexts using OR condition
        const result = await prisma.messageContext.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } }, // Records past their explicit expiry date
                    { createdAt: { lt: cutoffTime } }   // Records older than specified hours (fallback)
                ]
            }
        });
        
        console.log(`✅ Cleanup completed: ${result.count} MessageContext records deleted`);
        
        // Return success result with metadata
        return {
            success: true,
            deletedCount: result.count,
            cutoffTime: cutoffTime.toISOString(),
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        // Log error and return failure result
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
 * Clean up old Message records
 * 
 * Message records store all WhatsApp messages (incoming and outgoing) for:
 * - Audit trails and conversation history
 * - Debugging and troubleshooting
 * - Analytics and reporting
 * 
 * However, very old messages can be safely deleted to:
 * - Reduce database size and improve performance
 * - Comply with data retention policies
 * - Free up storage space
 * 
 * Note: This cleanup is optional and should be configured based on
 * business requirements for message retention.
 * 
 * @param {number} olderThanDays - Delete records older than X days (default: 30)
 * @returns {Object} Cleanup result with success status and deletion count
 */
const cleanupOldMessages = async (olderThanDays = 30) => {
    try {
        // Calculate cutoff time based on days parameter
        const cutoffTime = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
        
        console.log(`🧹 Starting cleanup of Message records older than ${olderThanDays} days...`);
        
        // Delete old message records
        const result = await prisma.message.deleteMany({
            where: {
                createdAt: { lt: cutoffTime } // Messages older than cutoff time
            }
        });
        
        console.log(`✅ Message cleanup completed: ${result.count} records deleted`);
        
        // Return success result with metadata
        return {
            success: true,
            deletedCount: result.count,
            cutoffTime: cutoffTime.toISOString()
        };
    } catch (error) {
        // Log error and return failure result
        console.error('❌ Error during Message cleanup:', error);
        return { success: false, error: error.message, deletedCount: 0 };
    }
};

/**
 * Schedule automatic cleanup to run weekly
 * 
 * Sets up a cron job to automatically clean up old data on a regular schedule.
 * This prevents manual intervention and ensures consistent database maintenance.
 * 
 * Schedule: Weekly on Mondays at 10:00 AM (Europe/Istanbul timezone)
 * 
 * Cleanup tasks performed:
 * - MessageContext records older than 184 hours (~7.7 days)
 * - Message records older than 30 days
 * 
 * The weekly schedule balances:
 * - Regular maintenance without excessive overhead
 * - Off-peak timing to minimize impact on users
 * - Sufficient frequency to prevent data accumulation
 * 
 * @returns {void}
 */
const scheduleAutomaticCleanup = () => {
    // Schedule cleanup for Mondays at 10:00 AM
    // Cron format: '0 10 * * 1' = minute hour day-of-month month day-of-week
    cron.schedule('0 10 * * 1', async () => {
        console.log('🕐 Running scheduled cleanup at 10:00 AM...');
        
        try {
            // Clean up MessageContexts older than 184 hours (~7.7 days)
            await cleanupExpiredMessageContexts(184);
            
            // Clean up Messages older than 30 days (optional, configurable)
            await cleanupOldMessages(30);
            
            console.log('✅ Scheduled cleanup completed successfully');
        } catch (error) {
            console.error('❌ Scheduled cleanup failed:', error);
        }
    }, {
        timezone: "Europe/Istanbul" // Match your application's timezone
    });
    
    console.log('📅 Automatic cleanup scheduled: Weekly on Mondays at 10:00 AM (Europe/Istanbul)');
};

/**
 * Run cleanup immediately for manual execution
 * 
 * Provides a way to manually trigger cleanup operations without waiting
 * for the scheduled cron job. Useful for:
 * - Initial cleanup after deployment
 * - Emergency cleanup when database is getting full
 * - Testing cleanup functionality
 * - One-time maintenance operations
 * 
 * Executes the same cleanup operations as the scheduled job:
 * - MessageContext cleanup (184 hours)
 * - Message cleanup (30 days)
 * 
 * @returns {Object} Combined results from both cleanup operations
 */
const runCleanupNow = async () => {
    console.log('🚀 Running manual cleanup...');
    
    try {
        // Execute both cleanup operations
        const contextResult = await cleanupExpiredMessageContexts(184);
        const messageResult = await cleanupOldMessages(30);
        
        // Return combined results for reporting
        return {
            messageContexts: contextResult, // MessageContext cleanup results
            messages: messageResult, // Message cleanup results
            timestamp: new Date().toISOString() // When cleanup was executed
        };
    } catch (error) {
        console.error('❌ Manual cleanup failed:', error);
        throw error; // Re-throw for caller handling
    }
};

// Export all cleanup service functions for use in other modules
module.exports = {
    cleanupExpiredMessageContexts, // Function to clean up expired message contexts
    cleanupOldMessages, // Function to clean up old message records
    scheduleAutomaticCleanup, // Function to schedule automatic cleanup cron job
    runCleanupNow // Function to run cleanup immediately (manual execution)
};
