require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const app = express();
const userRoutes = require('./routes/userRoute');
const whatsappRoutes = require('./routes/whatsappRoute');
const webhookRoutes = require('./routes/webhookRoute');
const courseRoute = require('./routes/courseRoute');
const { scheduleAutomaticCleanup } = require('./services/cleanupService');
const ngrok = require('@ngrok/ngrok');

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parser middleware
app.use(express.json());


// Routes
app.use('/api/v1', webhookRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/courses', courseRoute);




app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start automatic cleanup scheduler
  scheduleAutomaticCleanup();

  try {
    const listener = await ngrok.connect({
      addr: PORT, // Your Node.js app's port
      authtoken: process.env.NGROK_AUTHTOKEN, // Set your auth token in .env
      domain: 'climbing-cosmic-pegasus.ngrok-free.app' // Your reserved static domain

    });
    console.log(`ngrok tunnel started at: ${listener}`);
    console.log(listener);
  } catch (error) {
    console.error('Error starting ngrok:', error);
    console.error('ngrok error details:', error.message, error.response?.data);
  }
});