import express from 'express';
import connectDB from './config/dbConfig.js';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import config from './config/serverConfig.js';
import mongoose from 'mongoose';

import authRoutes from './routes/v1/authRoutes.js';
import wasteRoutes from './routes/v1/wasteLogRoutes.js';
import pickupRoutes from './routes/v1/pickupRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Basic middleware
app.use(express.json({ limit: config.MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: config.MAX_FILE_SIZE }));
app.use(compression());
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API version prefix
const API_PREFIX = `${config.API_PREFIX}/${config.API_VERSION}`;

// Mount API routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/waste`, wasteRoutes);
app.use(`${API_PREFIX}/pickup`, pickupRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize server
const server = app.listen(config.PORT, () => {
    console.log(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    // Connect to database
    connectDB()
        .then(() => console.log('Database connected successfully'))
        .catch(err => {
            console.error('Database connection error:', err);
            process.exit(1);
        });
});

// Graceful shutdown handling
const gracefulShutdown = () => {
    console.log('Received shutdown signal. Closing HTTP server...');
    server.close(() => {
        console.log('HTTP server closed.');
        // Close database connection
        mongoose.connection.close(false, () => {
            console.log('Database connection closed.');
            process.exit(0);
        });
    });

    // Force close if graceful shutdown fails
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled rejection handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
});

export default app;