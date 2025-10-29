/**
 * Redis Connection Module
 * 
 * This module establishes and manages the Redis connection used throughout the application.
 * Redis is used for:
 * - Message queue management (BullMQ)
 * - Job scheduling and processing
 * - Caching (optional)
 * - Session storage (optional)
 * 
 * The connection is shared across all services to avoid creating multiple connections.
 * 
 * @module redis-connection
 * @requires ioredis - Redis client library
 * @requires dotenv - Environment variable management
 */

// Step 1: Load environment variables from .env file
// This must be done before accessing process.env variables
require('dotenv').config();

// Step 2: Import required dependencies
const IORedis = require('ioredis'); // IORedis client (preferred for BullMQ compatibility)

// Step 3: Create Redis connection with configuration from environment variables
let connection = null;
// IORedis is used instead of standard Redis client because it's recommended by BullMQ
const getRedisConnection = () => {
  // If connection is not already created, create it
  if (!connection) {
    connection = new IORedis({ 
      // Redis server hostname (e.g., 'localhost' or remote server address)
      host: process.env.REDIS_HOST, 
      
      // Redis server port (default: 6379)
      port: Number(process.env.REDIS_PORT), 
  
      // Redis username for authentication (Redis 6.0+)
      username: process.env.REDIS_USERNAME, 
      
      // Redis password for authentication
      password: process.env.REDIS_PASSWORD,
      
      // Step 4: Configure retry behavior for BullMQ compatibility
      // Setting maxRetriesPerRequest to null is recommended by BullMQ
      // This prevents ioredis from automatically retrying failed commands,
      // allowing BullMQ to handle retries at the job level instead
      maxRetriesPerRequest: null,
    });

    // Step 5: Set up error event listener
    // This catches connection errors and logs them for debugging
    connection.on('error', (err) => {
      console.error('❌ Could not connect to Redis:', err);
      // Note: The connection will automatically retry based on ioredis default settings
    });

    // Step 6: Set up connection success event listener
    // This confirms when the Redis connection is established successfully
    connection.on('connect', () => {
      console.log('✅ Successfully connected to Redis!');
    });

  }

  return connection;
}


// Step 7: Export the connection instance for use in other modules
// This shared connection is used by:
// - queueService.js (for BullMQ queues)
// - workerService.js (for processing jobs)
// - Any other services that need Redis access
module.exports = {
  getRedisConnection
};  