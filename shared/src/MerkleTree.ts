// @ts-ignore
import { buildPoseidon } from 'circomlibjs';
import { MerkleProof, MerkleTreeData, DEFAULT_MERKLE_DEPTH } from './types';

export class MerkleTree {
  private tree: bigint[][];
  private leaves: bigint[];
  private readonly depth: number;
  private zeroHashes: { [level: number]: bigint };
  private poseidon: any;
  private isInitialized = false;

  constructor(depth: number = DEFAULT_MERKLE_DEPTH) {
    this.depth = depth;
    this.tree = [];
    this.leaves = [];
    this.zeroHashes = { 0: 0n };
  }

  /**
   * Initialize the Merkle tree with Poseidon hash function
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.poseidon = await buildPoseidon();
    this.computeZeroHashes();
    this.isInitialized = true;
  }

  /**
   * Precompute zero hashes for all levels
   */
  private computeZeroHashes(): void {
    for (let level = 1; level <= this.depth; level++) {
      if (!(level in this.zeroHashes)) {
        const prevLevelZero = this.zeroHashes[level - 1];
        this.zeroHashes[level] = BigInt(
          this.poseidon.F.toString(this.poseidon([prevLevelZero, prevLevelZero]))
        );
      }
    }
  }

  /**
   * Get zero hash at a specific level
   */
  private getZeroHash(level: number): bigint {
    return this.zeroHashes[level];
  }

  /**
   * Initialize tree from existing leaves (rebuild from scratch)
   */
  async initializeFromLeaves(leaves: (string | bigint)[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Convert string leaves to bigint if needed
    this.leaves = leaves.map(leaf => typeof leaf === 'string' ? BigInt(leaf) : leaf);
    
    this.rebuildTree();
  }

  /**
   * Add a single leaf incrementally to the tree
   */
  addLeaf(leaf: string | bigint): void {
    if (!this.isInitialized) {
      throw new Error('MerkleTree not initialized. Call initialize() first.');
    }

    const leafBigInt = typeof leaf === 'string' ? BigInt(leaf) : leaf;
    const leafIndex = this.leaves.length;
    this.leaves.push(leafBigInt);

    // Update tree incrementally
    this.updateTreeForNewLeaf(leafIndex);
  }

  /**
   * Add multiple leaves incrementally
   */
  addLeaves(leaves: (string | bigint)[]): void {
    leaves.forEach(leaf => this.addLeaf(leaf));
  }

  /**
   * Rebuild the entire tree from current leaves
   */
  private rebuildTree(): void {
    this.tree = [];

    // Initialize first level with leaves
    this.tree[0] = [...this.leaves];

    // Build tree level by level
    for (let level = 0; level < this.depth; level++) {
      const currentLevel = this.tree[level] || [];
      const nextLevel: bigint[] = [];

      // Calculate the number of nodes needed at this level
      const currentLevelSize = Math.max(currentLevel.length, 1);
      
      for (let i = 0; i < currentLevelSize; i += 2) {
        const left = currentLevel[i] !== undefined ? currentLevel[i] : this.getZeroHash(level);
        const right = currentLevel[i + 1] !== undefined ? currentLevel[i + 1] : this.getZeroHash(level);
        
        const parent = BigInt(this.poseidon.F.toString(this.poseidon([left, right])));
        nextLevel.push(parent);
      }

      this.tree[level + 1] = nextLevel;
    }
  }

  /**
   * Incrementally update tree when a new leaf is added
   */
  private updateTreeForNewLeaf(leafIndex: number): void {
    // Ensure tree structure exists
    if (this.tree.length === 0) {
      this.rebuildTree();
      return;
    }

    // Update level 0 (leaves)
    if (!this.tree[0]) this.tree[0] = [];
    this.tree[0][leafIndex] = this.leaves[leafIndex];

    let currentIndex = leafIndex;

    // Propagate changes up the tree
    for (let level = 0; level < this.depth; level++) {
      const parentIndex = Math.floor(currentIndex / 2);
      const isRightChild = currentIndex % 2 === 1;
      
      // Ensure next level exists
      if (!this.tree[level + 1]) this.tree[level + 1] = [];

      // Get sibling
      const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;
      const currentLevel = this.tree[level] || [];
      
      const left = isRightChild 
        ? (currentLevel[siblingIndex] !== undefined ? currentLevel[siblingIndex] : this.getZeroHash(level))
        : (currentLevel[currentIndex] !== undefined ? currentLevel[currentIndex] : this.getZeroHash(level));
        
      const right = isRightChild
        ? (currentLevel[currentIndex] !== undefined ? currentLevel[currentIndex] : this.getZeroHash(level))
        : (currentLevel[siblingIndex] !== undefined ? currentLevel[siblingIndex] : this.getZeroHash(level));

      // Calculate parent hash
      const parentHash = BigInt(this.poseidon.F.toString(this.poseidon([left, right])));
      this.tree[level + 1][parentIndex] = parentHash;

      currentIndex = parentIndex;
    }
  }

  /**
   * Generate Merkle proof for a specific leaf index
   */
  generateProof(leafIndex: number): MerkleProof {
    if (!this.isInitialized) {
      throw new Error('MerkleTree not initialized');
    }

    if (leafIndex >= this.leaves.length) {
      throw new Error('Leaf index out of bounds');
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let currentIndex = leafIndex;

    // Generate proof by collecting siblings at each level
    for (let level = 0; level < this.depth; level++) {
      const isRightChild = currentIndex % 2 === 1;
      const siblingIndex = isRightChild ? currentIndex - 1 : currentIndex + 1;
      
      const currentLevel = this.tree[level] || [];
      const siblingValue = currentLevel[siblingIndex] !== undefined
        ? currentLevel[siblingIndex]
        : this.getZeroHash(level);

      pathElements.push(siblingValue);
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

  /**
   * Get the current root of the tree
   */
  getRoot(): bigint {
    if (!this.isInitialized) {
      throw new Error('MerkleTree not initialized');
    }

    if (this.leaves.length === 0) {
      return this.getZeroHash(this.depth);
    }

    if (!this.tree[this.depth] || this.tree[this.depth].length === 0) {
      return this.getZeroHash(this.depth);
    }

    return this.tree[this.depth][0];
  }

  /**
   * Get all leaves
   */
  getLeaves(): bigint[] {
    return [...this.leaves];
  }

  /**
   * Get tree data for API responses
   */
  getTreeData(): MerkleTreeData {
    if (!this.isInitialized) {
      throw new Error('MerkleTree not initialized');
    }

    return {
      leaves: this.getLeaves(),
      root: this.getRoot(),
      depth: this.depth,
      totalLeaves: this.leaves.length
    };
  }

  /**
   * Get the number of leaves in the tree
   */
  getLeafCount(): number {
    return this.leaves.length;
  }

  /**
   * Find the index of a specific leaf (commitment)
   */
  findLeafIndex(leaf: string | bigint): number | null {
    const leafBigInt = typeof leaf === 'string' ? BigInt(leaf) : leaf;
    const index = this.leaves.findIndex(l => l === leafBigInt);
    return index === -1 ? null : index;
  }

  /**
   * Check if a leaf exists in the tree
   */
  hasLeaf(leaf: string | bigint): boolean {
    return this.findLeafIndex(leaf) !== null;
  }

  /**
   * Verify a Merkle proof
   */
  verifyProof(proof: MerkleProof): boolean {
    if (!this.isInitialized) {
      throw new Error('MerkleTree not initialized');
    }

    try {
      let computedHash = proof.leaf;
      
      for (let i = 0; i < proof.pathElements.length; i++) {
        const pathElement = proof.pathElements[i];
        const isRightNode = proof.pathIndices[i] === 1;
        
        if (isRightNode) {
          computedHash = BigInt(this.poseidon.F.toString(this.poseidon([pathElement, computedHash])));
        } else {
          computedHash = BigInt(this.poseidon.F.toString(this.poseidon([computedHash, pathElement])));
        }
      }
      
      return computedHash === proof.root;
    } catch (error) {
      return false;
    }
  }
}
