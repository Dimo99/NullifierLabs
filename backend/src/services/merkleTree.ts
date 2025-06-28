import { MerkleTree } from '@private-mixer/shared';
import { logger } from '../utils/logger';
import { MerkleProof, MerkleTreeResponse } from '../types';

export class MerkleTreeService {
  private static instance: MerkleTreeService;
  private merkleTree: MerkleTree;

  private constructor() {
    this.merkleTree = new MerkleTree();
  }

  public static getInstance(): MerkleTreeService {
    if (!MerkleTreeService.instance) {
      MerkleTreeService.instance = new MerkleTreeService();
    }
    return MerkleTreeService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing MerkleTreeService...');
      await this.merkleTree.initialize();
      logger.info('MerkleTreeService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MerkleTreeService:', error);
      throw error;
    }
  }

  public addLeaf(commitment: string): void {
    this.merkleTree.addLeaf(commitment);
    logger.info(`Added leaf at index ${this.merkleTree.getLeafCount() - 1}: ${commitment}`);
  }

  public getRoot(): string {
    return this.merkleTree.getRoot().toString();
  }

  public getMerkleProof(leafIndex: number): MerkleProof {
    const proof = this.merkleTree.generateProof(leafIndex);
    
    // Convert BigInt proof to string format for API compatibility
    return {
      pathElements: proof.pathElements.map(p => p.toString()),
      pathIndices: proof.pathIndices,
      root: proof.root.toString(),
      leaf: proof.leaf.toString()
    };
  }

  public getMerkleTreeData(): MerkleTreeResponse {
    const treeData = this.merkleTree.getTreeData();
    
    // Convert BigInt data to string format for API compatibility
    return {
      leaves: treeData.leaves.map(l => l.toString()),
      root: treeData.root.toString(),
      depth: treeData.depth,
      totalLeaves: treeData.totalLeaves
    };
  }

  public getAllLeaves(): string[] {
    return this.merkleTree.getLeaves().map(l => l.toString());
  }

  public getLeafCount(): number {
    return this.merkleTree.getLeafCount();
  }

  public rebuildFromLeaves(leaves: string[]): void {
    logger.info(`Rebuilding tree with ${leaves.length} leaves`);
    
    // Use the shared MerkleTree's rebuild functionality
    this.merkleTree.initializeFromLeaves(leaves);
    
    logger.info(`Tree rebuilt with root: ${this.getRoot()}`);
  }
}
