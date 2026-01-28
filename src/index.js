import express from 'express';
import dotenv from 'dotenv';
import postsRouter from './routes/posts.js';
import { startCronJob, triggerJob } from './services/cron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pps-backend'
  });
});

// API Routes
app.use('/api/posts', postsRouter);

// Manual trigger endpoint for testing (optional - consider adding auth)
app.post('/api/jobs/trigger', async (req, res) => {
  try {
    console.log('🔄 Manual job trigger requested');
    await triggerJob();
    res.json({
      success: true,
      message: 'Job triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger job',
      message: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📰 Posts API: http://localhost:${PORT}/api/posts`);
  
  // Start cron job scheduler
  startCronJob();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
