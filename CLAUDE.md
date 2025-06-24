# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a zero-knowledge private mixer protocol called "Cipherpay" that enables private transactions on blockchain networks. The project consists of three main components:

### Core Components

**1. Zero-Knowledge Circuits (`circuits/`)**
- Written in Circom language for zk-SNARK proof generation
- Key circuits: `withdraw.circom`, `note_commitment.circom`, `nullifier.circom`, `merkle_proof.circom`
- Uses Poseidon hashing and Merkle tree proofs
- Proves withdrawal validity without revealing note details

**2. EVM Smart Contracts (`contracts-evm/`)**
- Solidity contracts for Ethereum-compatible chains
- Main contract: `PrivateMixer.sol` - handles deposits, withdrawals, and Merkle tree management
- Uses Groth16 verifier for zk-SNARK proof verification
- Built with Foundry framework

**3. Solana Contracts (`contracts-solana/`)**
- Planned Solana implementation (directory exists but may be empty)

## Development Commands

### Circuit Testing
```bash
# Run integration tests (recommended)
npm test

# Run specific circuit tests individually (if needed for debugging)
npm run test:nullifier
npm run test:note-commitment
npm run test:merkle-proof
npm run test:withdraw
```

### EVM Contract Development
```bash
# Navigate to contracts directory
cd contracts-evm

# Build contracts
forge build

# Run tests
forge test

# Deploy contracts
forge script script/Deploy.s.sol

# Run specific test
forge test --match-test testWithdraw
```

## Key Architecture Details

**UTXO Model**: Uses unspent transaction output model with private notes containing (amount, randomness, public_key)

**Merkle Tree**: Maintains on-chain Merkle tree of note commitments with 30-level depth, supports up to 2^30 notes

**Nullifiers**: Prevents double-spending using nullifiers derived from note secret key and randomness

**Relay System**: Supports transaction relaying to preserve sender anonymity with configurable relay fees

**Change Notes**: Supports partial withdrawals by creating change notes for remaining balance

## Circuit Parameters
- Merkle depth: 30 levels
- Field size: 252 bits for comparisons
- Hash function: Poseidon (circuits) / Keccak256 (temporary in contracts)

## Smart Contract Key Features
- Deposit function: Adds note commitments to Merkle tree
- Withdraw function: Verifies zk-SNARK proofs and processes withdrawals
- Merkle root history: Maintains 10 recent roots for proof flexibility
- Pausable and upgradeable with owner controls

## File Structure Notes
- Circuit compilation outputs in `circuits/outputs/`
- Trusted setup files: `powersOfTau28_hez_final_14.ptau`
- Generated verifiers in `circuits/outputs/*/verifier.sol`
- Integration tests in `circuits/test/integration_test.ts`