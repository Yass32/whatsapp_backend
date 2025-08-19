require('dotenv').config();
const {createClient} = require('redis');
const IORedis = require('ioredis');

/*
const connection = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT)
    }
});
*/
const connection = new IORedis({ 
  host: process.env.REDIS_HOST, 
  port: Number(process.env.REDIS_PORT), 
  username: process.env.REDIS_USERNAME, 
  password: process.env.REDIS_PASSWORD,
  // Recommended by BullMQ to avoid unhandled retries inside ioredis
  maxRetriesPerRequest: null,
})


connection.on('error', (err) => {
  console.error('❌ Could not connect to Redis:');
  console.error(err);
});

// connection.connect();

connection.on('connect', () => {
  console.log('✅ Successfully connected to Redis!');
});

module.exports = connection;  