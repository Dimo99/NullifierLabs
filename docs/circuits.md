# 🔌 Circuit Documentation

This document provides detailed information about the zero-knowledge circuits used in CipherPay.

## Overview

CipherPay uses Circom 2.2.0 to implement zk-SNARK circuits that prove the validity of private transactions without revealing sensitive information. The circuits use the BN254 elliptic curve and Poseidon hash function for optimal efficiency and security.

## Circuit Architecture

### Main Circuit: `withdraw.circom`

The withdrawal circuit is the core component that proves a user can legitimately withdraw funds from the mixer.

**Public Inputs:**
- `merkle_root`: Current Merkle tree root
- `withdraw_amount`: Amount to withdraw (in wei)
- `recipient`: Withdrawal recipient address
- `relay_fee`: Fee paid to relay service
- `nullifier`: Unique identifier preventing double-spending
- `new_commitment`: Commitment for change note

**Private Inputs:**
- `note_amount`: Original note amount
- `note_secret_key`: Secret key for the note
- `new_note_secret_key`: Secret key for change note
- `merkle_path_elements[30]`: Merkle proof path elements
- `merkle_path_indices[30]`: Merkle proof path indices


**Circuit Logic:**
1. **Note Verification**: Computes note commitment and verifies it exists in Merkle tree
2. **Nullifier Generation**: Creates unique nullifier from secret key and commitment
3. **Amount Validation**: Ensures withdrawal + relay fee ≤ note amount
4. **Change Note**: Generates commitment for remaining funds

### Supporting Circuits

#### `note_commitment.circom`
Computes note commitments using Poseidon hash.

```circom
template NoteCommitment() {
    signal input amount;
    signal input pubkey;
    signal output commitment;

    commitment <== Poseidon(2)([amount, pubkey]);
}
```

**Purpose**: Creates a cryptographic commitment to a note's amount and public key.

#### `nullifier.circom`
Generates unique nullifiers to prevent double-spending.

```circom
template Nullifier() {
    signal input secret_key;
    signal input commitment;
    signal output nullifier;

    nullifier <== Poseidon(2)([secret_key, commitment]);
}
```

**Purpose**: Creates a unique identifier that's revealed when spending a note, preventing reuse.

#### `merkle_proof.circom`
Verifies Merkle tree inclusion proofs.

```circom
template MerkleProof(depth) {
    signal input leaf;
    signal input root;
    signal input path_elements[depth];
    signal input path_indices[depth];
    signal output is_valid;
    
    // Verifies leaf is included in tree with given root
}
```

**Purpose**: Proves a commitment exists in the Merkle tree without revealing which one.

## Circuit Parameters

### Constants
- **Merkle Depth**: 30 levels (supports 2^30 = ~1 billion notes)
- **Field Size**: BN254 scalar field (254 bits)
- **Hash Function**: Poseidon (optimized for zk-SNARKs)

### Security Properties
- **Zero-Knowledge**: No private information is revealed
- **Soundness**: Invalid proofs cannot be generated
- **Completeness**: Valid proofs always verify correctly

## Compilation and Setup

### Prerequisites
```bash
npm install -g circom
npm install snarkjs
```

### Compilation Process

1. **Compile Circuit**:
```bash
circom withdraw.circom --r1cs --wasm --sym --O2 -o outputs/
```

2. **Generate Trusted Setup**:
```bash
# Download powers of tau (one-time setup)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau

# Generate circuit-specific setup
snarkjs groth16 setup outputs/withdraw.r1cs powersOfTau28_hez_final_14.ptau outputs/circuit_final.zkey
```

3. **Export Verification Key**:
```bash
snarkjs zkey export verificationkey outputs/circuit_final.zkey outputs/verification_key.json
```

4. **Generate Solidity Verifier**:
```bash
snarkjs zkey export solidityverifier outputs/circuit_final.zkey outputs/verifier.sol
```

## Testing

### Test Structure

Each circuit has comprehensive tests in the `circuits/scripts/test_*` directories:

- `test_note_commitment/`: Tests note commitment computation
- `test_nullifier/`: Tests nullifier generation
- `test_merkle_proof/`: Tests Merkle proof verification
- `test_withdraw/`: Tests full withdrawal circuit

### Running Tests

```bash
# Run all circuit tests
npm test

# Run specific tests
npm run test:nullifier
npm run test:note-commitment
npm run test:merkle-proof
npm run test:withdraw
```

### Test Cases

#### Valid Withdrawal Test
Tests a complete valid withdrawal scenario:
- Generates random note with secret key
- Builds Merkle tree with note commitment
- Creates valid Merkle proof
- Verifies circuit accepts the proof

#### Invalid Withdrawal Tests
Tests various failure scenarios:
- Invalid Merkle proofs
- Insufficient note amounts
- Incorrect nullifier computation
- Field overflow conditions

### Research Directions
- **Recursive Proofs**: Enable proof composition
- **Privacy Enhancements**: Additional privacy-preserving features
