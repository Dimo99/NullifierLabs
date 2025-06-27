// Deposit event from the contract
export interface DepositEvent {
  commitment: string;
  amount: string;
  depositor: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

// Merkle tree node
export interface MerkleNode {
  level: number;
  index: number;
  value: string;
}

// Merkle proof
export interface MerkleProof {
  pathElements: string[];
  pathIndices: number[];
  root: string;
  leaf: string;
}

// API response types
export interface MerkleTreeResponse {
  leaves: string[];
  root: string;
  depth: number;
  totalLeaves: number;
}

export interface MerkleProofResponse extends MerkleProof {
  leafIndex: number;
}

// Configuration
export interface Config {
  rpcUrl: string;
  contractAddress: string;
  startBlock: number;
  confirmations: number;
  merkleDepth: number;
}