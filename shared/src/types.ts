// Core types for Merkle tree operations
export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
  leaf: bigint;
}

export interface MerkleTreeData {
  leaves: bigint[];
  root: bigint;
  depth: number;
  totalLeaves: number;
}

export const DEFAULT_MERKLE_DEPTH = 30;
