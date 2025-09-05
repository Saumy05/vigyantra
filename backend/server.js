// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Import routes
const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const scanRoutes = require('./routes/scanRoutes');

// Import utilities
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('✅ MongoDB connected successfully');
})
.catch((err) => {
  logger.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Security & Performance Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Logging middleware
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving (for downloading resumes if needed)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
    version: '2.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api', scanRoutes);

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'Resume Scanner API v2.0 - Client Ready',
    version: '2.0.0',
    endpoints: {
      authentication: {
        'POST /api/auth/register': 'Register HR/Admin user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/profile': 'Get user profile'
      },
      jobs: {
        'POST /api/jobs': 'Create job posting (HR only)',
        'GET /api/jobs': 'Get all job postings',
        'GET /api/jobs/:id/candidates': 'Get ranked candidates for job'
      },
      scanning: {
        'POST /api/scan-resume': 'Upload and process resume',
        'GET /api/history': 'Get scan history with filters'
      }
    },
    features: [
      'JWT Authentication',
      'Role-based access control',
      'Resume-job matching algorithm',
      'Permanent file storage',
      'Advanced search and filtering',
      'Comprehensive logging',
      'Production-ready security'
    ]
  });
});

// 404 handler (catch-all, must be after all routes)
app.use((req, res) => {
  res.status(404).json({ 
    message: 'API endpoint not found',
    path: req.originalUrl 
  });
});


// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down server gracefully...');
  mongoose.connection.close(() => {
    logger.info('📊 MongoDB connection closed');
    process.exit(0);
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📄 API Documentation: http://localhost:${PORT}/`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🗄️  MongoDB: ${process.env.MONGODB_URI}`);
  logger.info(`🐍 Python Service: ${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}`);
});

module.exports = app;
