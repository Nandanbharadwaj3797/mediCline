import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Required environment variables
const requiredEnvVars = [
    'DB_URL',
    'JWT_SECRET',
    'NODE_ENV'
];

// Optional environment variables with defaults
const config = {
    // Server
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database
    DB_URL: process.env.DB_URL || 'mongodb://localhost:27017/mediclean',
    
    // Authentication
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: process.env.JWT_EXPIRY || '1d',
    
    // AWS Configuration
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,

    // API Configuration
    API_VERSION: 'v1',
    API_PREFIX: '/api',
    
    // CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,
    
    // File Upload
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || '10mb',
};

// Validate required environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Validate JWT secret in production
if (config.NODE_ENV === 'production' && (!config.JWT_SECRET || config.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production');
}

// Validate AWS credentials if AWS features are used
if (config.AWS_BUCKET_NAME && (!config.AWS_ACCESS_KEY_ID || !config.AWS_SECRET_ACCESS_KEY)) {
    throw new Error('AWS credentials are required when AWS_BUCKET_NAME is specified');
}

export default config;