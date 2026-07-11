const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Admin, Caller, Service } = require('./models');
const routes = require('./routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/growstack';

// Rate Limiting to prevent DOS/API abuse
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 mins default
  max: parseInt(process.env.RATE_LIMIT_MAX || 100), // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again later.' }
});

// Production CORS security configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Security headers with configured CSP for React app asset security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "http://localhost:5000", "https://*"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  }
}));

// Performance-optimizing gzip compression
app.use(compression());

// Clean HTTP logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes with rate limiting protection
app.use('/api', apiLimiter, routes);

// Simple status check route
app.get('/', (req, res) => {
  res.send('GrowStack API Server is running...');
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected server error occurred.' 
      : err.message || 'Internal Server Error'
  });
});

let serverInstance;

// Database Connection and Seeding
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB.');

    // Seed Admin if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@growstack.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin@20';
    
    try {
      const existingAdmin = await Admin.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const newAdmin = new Admin({
          email: adminEmail,
          password: hashedPassword
        });
        await newAdmin.save();
        console.log(`Default admin user seeded: ${adminEmail}`);
      } else {
        console.log('Admin user already exists.');
      }
    } catch (err) {
      console.error('Error seeding admin user:', err);
    }

    // Seed Caller accounts
    const callerAccounts = [
      { email: 'caller@growstack.com', password: 'caller@123', name: 'GrowStack Caller' }
    ];
    for (const callerData of callerAccounts) {
      try {
        const existingCaller = await Caller.findOne({ email: callerData.email });
        if (!existingCaller) {
          const hashedPassword = await bcrypt.hash(callerData.password, 10);
          const newCaller = new Caller({
            email: callerData.email,
            password: hashedPassword,
            name: callerData.name
          });
          await newCaller.save();
          console.log(`Default caller seeded: ${callerData.email}`);
        } else {
          console.log(`Caller already exists: ${callerData.email}`);
        }
      } catch (err) {
        console.error(`Error seeding caller ${callerData.email}:`, err);
      }
    }

    // Seed default services if database is empty
    try {
      const serviceCount = await Service.countDocuments();
      if (serviceCount === 0) {
        const defaultServices = [
          {
            title: '3D Web Applications',
            description: 'Stunning scroll-driven 3D experiences, interactive canvas interfaces, and WebGL animations designed to captivate your audience.',
            icon: 'Cpu',
            order: 1
          },
          {
            title: 'AI & Machine Learning Integrations',
            description: 'Seamless integration of LLMs, predictive analysis modules, neural search capabilities, and custom AI tools into your workflows.',
            icon: 'Brain',
            order: 2
          },
          {
            title: 'Full Stack Development',
            description: 'Scalable MERN stack architectures designed for high concurrency, robust database structures, and dynamic client experiences.',
            icon: 'Code',
            order: 3
          },
          {
            title: 'Cloud & DevOps Solutions',
            description: 'Automated CI/CD pipelines, high-availability deployments on AWS/GCP, and secure backend scaling policies.',
            icon: 'Cloud',
            order: 4
          }
        ];
        await Service.insertMany(defaultServices);
        console.log('Default services seeded successfully.');
      }
    } catch (err) {
      console.error('Error seeding default services:', err);
    }

    // Start Express server after successful DB connection
    serverInstance = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    console.warn('\nCRITICAL WARNING: MongoDB is not running or unreachable at ' + MONGODB_URI);
    console.warn('Please ensure MongoDB is installed and the service is running (`net start MongoDB` or `mongod`).\n');
    process.exit(1);
  });

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('Termination signal received. Shutting down server gracefully...');
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('Express server closed.');
      mongoose.connection.close(false).then(() => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Catch uncaught exceptions and unhandled rejections to prevent silent server death
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down server...', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! Shutting down server...', reason);
  process.exit(1);
});
