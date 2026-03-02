/*
server.js - Main Server File 
*/

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

const routes = require('./routes');
const db = require('./database');

/*
 INITIALIZE EXPRESS APP
*/
const app = express();

/*
MIDDLEWARE
*/
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5000',
  credentials: true
}));
app.use(express.static('public'));

/*
CLOUDINARY CONFIGURATION
*/

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured');

/*
DATABASE CONNECTION
*/

const initializeDatabase = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI not set in .env');
    }
    await db.connectDB(mongoURI);
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }
};

// ROUTES SETUP
app.use('/', routes);

// ERROR HANDLING MIDDLEWARE

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

/*
 404 HANDLER
*/
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/*
START SERVER
*/
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    // Connect to database first
    await initializeDatabase();

    // Start listening
    app.listen(PORT, () => {
      console.log('\n=============================================');
      console.log('  🚀 Shivashakti Server Running');
      console.log(`  📍 http://localhost:${PORT}`);
      console.log(`  🔐 Admin: http://localhost:${PORT}/admin`);
      console.log('=============================================\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

// EXPORTS (for testing)
module.exports = app;