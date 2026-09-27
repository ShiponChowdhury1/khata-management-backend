import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { logger } from './utils/logger.js';

// সার্ভার স্টার্ট
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Khata Management Server running on: http://localhost:${env.PORT}`);
  logger.info(`🩺 Health check URL: http://localhost:${env.PORT}/api/health`);
  logger.info(`🔐 Auth endpoint: http://localhost:${env.PORT}/api/auth`);
});

// সার্ভার গ্রেসফুল শাটডাউন হ্যান্ডলার
const handleShutdown = async (signal: string) => {
  logger.warn(`🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('🔒 Prisma database client disconnected successfully.');
      logger.info('👋 Server shutdown complete. Exiting process.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during database disconnection:', error);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default server;
