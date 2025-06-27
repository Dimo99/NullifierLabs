//@ts-ignore
import { buildPoseidon } from 'circomlibjs';
import { logger } from '../utils/logger';
import { MerkleProof, MerkleTreeResponse } from '../types';

export class MerkleTreeService {
  private static instance: MerkleTreeService;
  private poseidon: any;
  private leaves: string[] = [];
  private tree: bigint[][] = [];
  private readonly DEPTH = 30;
  private zeroHashes: { [level: number]: bigint } = { 0: 0n };
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): MerkleTreeService {
    if (!MerkleTreeService.instance) {
      MerkleTreeService.instance = new MerkleTreeService();
    }
    return MerkleTreeService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('Initializing MerkleTreeService...');
      
      // Initialize Poseidon hash function
      this.poseidon = await buildPoseidon();
      
      // Precompute zero hashes for all levels
      this.computeZeroHashes();
      
      this.isInitialized = true;
      logger.info('MerkleTreeService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MerkleTreeService:', error);
      throw error;
    }
  }

  private computeZeroHashes(): void {
    for (let level = 1; level <= this.DEPTH; level++) {
      if (!(level in this.zeroHashes)) {
        const prevLevelZero = this.zeroAtLevel(level - 1);
        this.zeroHashes[level] = BigInt(
          this.poseidon.F.toString(this.poseidon([prevLevelZero, prevLevelZero]))
        );
      }
    }
    
    logger.info(`Computed zero hashes for levels 0-${this.DEPTH}`);
  }

  private zeroAtLevel(level: number): bigint {
    if (level in this.zeroHashes) {
      return this.zeroHashes[level];
    }

    const prevLevelZero = this.zeroAtLevel(level - 1);
    this.zeroHashes[level] = BigInt(
      this.poseidon.F.toString(this.poseidon([prevLevelZero, prevLevelZero]))
    );

    return this.zeroHashes[level];
  }

  public addLeaf(commitment: string): void {
    if (!this.isInitialized) {
      throw new Error('MerkleTreeService not initialized');
    }

    // Add leaf to our tracking array
    this.leaves.push(commitment);
    
    // Rebuild tree efficiently
    this.buildTree();
    
    logger.info(`Added leaf at index ${this.leaves.length - 1}: ${commitment}`);
  }

  private buildTree(): void {
    const commitments = this.leaves.map(leaf => BigInt(leaf));
    this.tree = [];

    // Initialize first level with commitments
    const firstLevel: bigint[] = [...commitments];
    this.tree.push(firstLevel);

    // Build tree level by level
    for (let level = 0; level < this.DEPTH; level++) {
      const currentLevel = this.tree[level];
      const nextLevel: bigint[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel.length > i + 1 
          ? currentLevel[i + 1] 
          : this.zeroAtLevel(level);
        
        const parent = BigInt(
          this.poseidon.F.toString(this.poseidon([left, right]))
        );
        nextLevel.push(parent);
      }

      this.tree.push(nextLevel);
    }
  }

  public getRoot(): string {
    if (!this.isInitialized) {
      throw new Error('MerkleTreeService not initialized');
    }
    
    if (this.leaves.length === 0) {
      return this.zeroAtLevel(this.DEPTH).toString();
    }
    
    return this.tree[this.DEPTH][0].toString();
  }

  public getMerkleProof(leafIndex: number): MerkleProof {
    if (!this.isInitialized) {
      throw new Error('MerkleTreeService not initialized');
    }
    
    if (leafIndex >= this.leaves.length) {
      throw new Error('Leaf index out of bounds');
    }

    const pathElements: string[] = [];
    const pathIndices: number[] = [];
    let currentIndex = leafIndex;

    // Generate proof by collecting siblings at each level
    for (let level = 0; level < this.DEPTH; level++) {
      const isRightChild = currentIndex % 2 === 1;
      const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;

      const siblingValue = this.tree[level][siblingIndex] === undefined
        ? this.zeroHashes[level]
        : this.tree[level][siblingIndex];

      pathElements.push(siblingValue.toString());
      pathIndices.push(isRightChild ? 1 : 0);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      pathElements,
      pathIndices,
      root: this.getRoot(),
      leaf: this.leaves[leafIndex]
    };
  }

  public getMerkleTreeData(): MerkleTreeResponse {
    if (!this.isInitialized) {
      throw new Error('MerkleTreeService not initialized');
    }

    return {
      leaves: [...this.leaves],
      root: this.getRoot(),
      depth: this.DEPTH,
      totalLeaves: this.leaves.length
    };
  }

  public getAllLeaves(): string[] {
    return [...this.leaves];
  }

  public getLeafCount(): number {
    return this.leaves.length;
  }

  public rebuildFromLeaves(leaves: string[]): void {
    if (!this.isInitialized) {
      throw new Error('MerkleTreeService not initialized');
    }

    logger.info(`Rebuilding tree with ${leaves.length} leaves`);

    // Reset tree
    this.leaves = [...leaves];
    this.buildTree();
    
    logger.info(`Tree rebuilt with root: ${this.getRoot()}`);
  }
}