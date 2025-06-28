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

// Types for ZK proof generation
export interface WithdrawalProofInputs {
  noteAmount: bigint;
  noteSecretKey: bigint;
  commitments: bigint[];
  commitmentIndex: number;
  withdrawAmount: bigint;
  recipient: bigint;
  changeSecretKey: bigint;
  relayFee?: bigint;
}

export interface WithdrawalProofResult {
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  nullifier: string;
  newCommitment: string;
  merkleRoot: string;
  withdrawAmount: string;
  recipient: string;
  relayFee: string;
}

export interface ProofGenerationConfig {
  wasmPath: string;
  zkeyPath: string;
}

export interface CryptographicComponents {
  pubkey: string;
  commitment: string;
  nullifier: string;
  changeCommitment: string;
  changePubkey: string;
}
