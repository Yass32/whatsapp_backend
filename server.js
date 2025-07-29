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
const ngrok = require('ngrok');

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

  // Start ngrok tunnel
  const url = await ngrok.connect({
    addr: PORT,
    authtoken: process.env.NGROK_AUTHTOKEN // optional, if you have an ngrok account
  });
  console.log(`ngrok tunnel opened at: ${url}`);
  
});