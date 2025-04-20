// server->ODM ->database
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/mediclean";

// Mongoose connection options
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    autoIndex: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
};

/**
 * Connect to MongoDB
 * @returns {Promise} Mongoose connection promise
 */
export default async function connectDB() {
    try {
        // Handle initial connection errors
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        // Handle errors after initial connection
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('connected', () => {
            console.info('Successfully connected to MongoDB');
        });

        mongoose.connection.on('reconnected', () => {
            console.info('MongoDB reconnected');
        });

        // Connect to MongoDB
        await mongoose.connect(DB_URL, options);

        // Enable debug mode in development
        if (process.env.NODE_ENV === 'development') {
            mongoose.set('debug', true);
        }

        return mongoose.connection;
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error; // Propagate error to server startup
    }
}