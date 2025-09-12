// Load environment variables from .env file
// This module MUST be imported before any other modules that depend on environment variables
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envResult = dotenv.config({
  path: join(__dirname, '../.env'),
  override: false, // Preserve existing environment variables
  debug: process.env.DOTENV_DEBUG === 'true'
});

// Handle dotenv loading errors
if (envResult.error) {
  console.error('Environment file loading failed:', envResult.error.message);
  // For production, fail fast if .env is required
  if (process.env.NODE_ENV === 'production') {
    console.error('Critical: Environment file is required in production');
    process.exit(1);
  }
}

// Validate required environment variables
const requiredEnvVars = ['PORT'];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env file or system environment variables');
  process.exit(1);
}

// Log configuration in development only
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
  console.log('PORT from env:', process.env.PORT);
}

// Export a function to ensure environment is loaded (for explicit imports)
export const ensureEnvLoaded = () => {
  return true;
};
