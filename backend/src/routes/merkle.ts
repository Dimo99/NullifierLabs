import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { MerkleTreeService } from '../services/merkleTree';

const router = Router();

// GET /api/merkle/tree - Get full Merkle tree data (all leaves for privacy-preserving withdrawals)
router.get('/tree', async (req: Request, res: Response) => {
  try {
    const merkleTreeService = MerkleTreeService.getInstance();
    const treeData = merkleTreeService.getMerkleTreeData();
    
    logger.info(`Served Merkle tree with ${treeData.totalLeaves} leaves`);
    
    res.json({
      success: true,
      data: treeData
    });
  } catch (error) {
    logger.error('Error getting Merkle tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Merkle tree'
    });
  }
});

// GET /api/merkle/leaves - Get all leaves (users compute their own proofs)
router.get('/leaves', async (req: Request, res: Response) => {
  try {
    const merkleTreeService = MerkleTreeService.getInstance();
    const leaves = merkleTreeService.getAllLeaves();
    
    logger.info(`Served ${leaves.length} leaves`);
    
    res.json({
      success: true,
      data: {
        leaves,
        count: leaves.length
      }
    });
  } catch (error) {
    logger.error('Error getting leaves:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get leaves'
    });
  }
});

// GET /api/merkle/root - Get current Merkle root
router.get('/root', async (req: Request, res: Response) => {
  try {
    const merkleTreeService = MerkleTreeService.getInstance();
    const root = merkleTreeService.getRoot();
    
    logger.info(`Served Merkle root: ${root}`);
    
    res.json({
      success: true,
      data: {
        root,
        leafCount: merkleTreeService.getLeafCount()
      }
    });
  } catch (error) {
    logger.error('Error getting Merkle root:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Merkle root'
    });
  }
});

// GET /api/merkle/status - Get indexer status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const merkleTreeService = MerkleTreeService.getInstance();
    
    res.json({
      success: true,
      data: {
        leafCount: merkleTreeService.getLeafCount(),
        currentRoot: merkleTreeService.getRoot(),
        depth: 30,
        isHealthy: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

export { router as merkleRoutes };