const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const seedDB = require('./seed/seedData');
const Product = require('./models/Product');

dotenv.config();

const mongoose = require('mongoose');
mongoose.set('bufferTimeoutMS', 2000);

const app = express();

// Connect to MongoDB
connectDB().then(async () => {
  try {
    // If products collection is empty, auto-seed demo data
    const count = await Product.countDocuments();
    if (count === 0) {
      console.log('🔄 First run detected: Auto-seeding database...');
      await seedDB();
    }
  } catch (err) {
    console.error('Initial auto-seed check warning:', err.message);
  }
});

// Middleware
app.use(cors({
  origin: true, // Echo origin so credentials work across tunnels, mobile and desktop
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'SportsHub Pro Full-Stack API',
  });
});

// Seeding endpoint (supports both GET and POST)
const handleSeed = async (req, res) => {
  try {
    await seedDB();
    res.json({ success: true, message: 'Database seeded successfully with sports demo data!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
app.post('/api/seed', handleSeed);
app.get('/api/seed', handleSeed);

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/trainers', require('./routes/trainerRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// Serve Frontend Static Files in Production / When dist exists
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const fs = require('fs');

if (fs.existsSync(frontendDistPath)) {
  console.log(`📦 Serving frontend static assets from: ${frontendDistPath}`);

  // Dual Domain Handler: if domain contains "admin" or path is /admin -> serve admin.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      const host = (req.headers.host || '').toLowerCase();
      const isExplicitAdminRoute = req.path === '/admin' || req.path.startsWith('/admin/') || req.path === '/admin.html';
      const isAdminHost = host.includes('admin') || host.includes('aerosportadmin');

      if ((isAdminHost && (req.path === '/' || req.path === '')) || isExplicitAdminRoute) {
        const adminHtmlPath = path.join(frontendDistPath, 'admin.html');
        if (fs.existsSync(adminHtmlPath)) {
          return res.sendFile(adminHtmlPath);
        }
      }
    }
    next();
  });

  // Serve static assets without auto-serving index.html
  app.use(express.static(frontendDistPath, { index: false }));

  // SPA fallback for all remaining non-API GET routes
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      const host = (req.headers.host || '').toLowerCase();
      const isExplicitAdminRoute = req.path === '/admin' || req.path.startsWith('/admin/') || req.path === '/admin.html';
      const isAdminHost = host.includes('admin') || host.includes('aerosportadmin');

      if (isAdminHost || isExplicitAdminRoute) {
        const adminHtmlPath = path.join(frontendDistPath, 'admin.html');
        if (fs.existsSync(adminHtmlPath)) {
          return res.sendFile(adminHtmlPath);
        }
      }

      // Otherwise serve main customer sports platform
      return res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
    next();
  });
}

// 404 Handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: `API route not found - ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express Error:', err.stack);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5050;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 SportsHub Backend Server running on http://localhost:${PORT}`);

    // 24/7 Render Self-Ping Keep-Alive Mechanism
    const RENDER_APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
    if (RENDER_APP_URL) {
      const protocol = RENDER_APP_URL.startsWith('https') ? require('https') : require('http');
      const PING_INTERVAL_MS = 10 * 60 * 1000; // Ping every 10 minutes to stay awake 24/7
      console.log(`⏱️ 24/7 Keep-Alive self-ping enabled for: ${RENDER_APP_URL}/api/health`);
      
      setInterval(() => {
        try {
          protocol.get(`${RENDER_APP_URL}/api/health`, (res) => {
            console.log(`💓 24/7 Keep-Alive heartbeat: ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
          }).on('error', (err) => {
            console.warn('Keep-alive ping warning:', err.message);
          });
        } catch (e) {
          // Ignore transient ping errors
        }
      }, PING_INTERVAL_MS);
    }
  });
}

module.exports = app;
