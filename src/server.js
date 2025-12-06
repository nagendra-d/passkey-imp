const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import routes
const passkeyRoutes = require('./routes/passkey');
const authRoutes = require('./routes/auth');

const fs = require('fs').promises;

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    service: 'Passkey Backend API'
  });
});

// Serve apple-app-site-association file
app.get('/.well-known/apple-app-site-association', (req, res) => {
  try {
    const body = JSON.stringify({
      webcredentials: {
        apps: [
          "KD6L2PTK2Q.com.grasshopper.dialer",
          "53ZCYLE745.com.grasshopper.dialer",
          "KD6L2PTK2Q.com.grasshopper.passkeys"
        ]
      }
    });

    // Disable Express default headers
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Length", Buffer.byteLength(body));

    // IMPORTANT: DO NOT call res.json(), res.send(), res.status()
    res.write(body);
    res.end();
  } catch (error) {
    console.error('Error serving AASA:', error);
    res.status(404).send('Not found');
  }
});


// API Routes
app.use('/api/passkeys', passkeyRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /health',
      'GET /api/passkeys',
      'POST /api/passkeys/register/begin',
      'POST /api/passkeys/register/complete',
      'POST /api/passkeys/login/begin',
      'POST /api/passkeys/login/complete',
      'DELETE /api/passkeys/:id',
      'POST /api/auth/signin'
    ]
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Passkey Backend API running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Passkey endpoints: http://localhost:${PORT}/api/passkeys`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
});

module.exports = app;
