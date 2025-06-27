import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { merkleRoutes } from './routes/merkle';
import { EventIndexer } from './services/eventIndexer';
import { MerkleTreeService } from './services/merkleTree';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/merkle', merkleRoutes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize services
async function initialize() {
  try {
    logger.info('Starting CipherPay Backend...');
    
    // Initialize Merkle tree service
    const merkleTreeService = MerkleTreeService.getInstance();
    await merkleTreeService.initialize();
    
    // Initialize event indexer
    const eventIndexer = EventIndexer.getInstance();
    await eventIndexer.initialize();
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Merkle API: http://localhost:${PORT}/api/merkle`);
    });
    
  } catch (error) {
    logger.error('Failed to initialize backend:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

// Start the application
initialize();