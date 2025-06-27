# 📜 Smart Contract Documentation

This document provides detailed API reference and architectural information about the Solidity smart contracts that power CipherPay.

> 🚀 **For quick setup, deployment, and basic usage, see [`contracts-evm/README.md`](../contracts-evm/README.md)**

## Overview

CipherPay's smart contracts are built using Solidity and the Foundry framework. The contracts handle deposits, withdrawals, Merkle tree management, and zk-SNARK proof verification on EVM-compatible blockchains.

## Contract Architecture

### Core Contracts

#### `PrivateMixer.sol` - Main Contract

The central contract that orchestrates all mixer functionality.

**Inheritance:**
- `ReentrancyGuard`: Prevents reentrancy attacks
- `Pausable`: Emergency pause functionality
- `Ownable`: Administrative controls
- `MerkleTree`: Merkle tree operations

**Key State Variables:**
```solidity
Groth16Verifier public immutable verifier;  // zk-SNARK verifier
mapping(uint256 => bool) public nullifierUsed;  // Prevent double-spending
```

**Main Functions:**

##### `deposit(uint256 pubkey)`
Allows users to deposit ETH into the mixer.

```solidity
function deposit(uint256 pubkey) external payable whenNotPaused nonReentrant
```

**Parameters:**
- `pubkey`: Public key derived from user's secret key

**Process:**
1. Computes commitment = Poseidon(amount, pubkey)
2. Inserts commitment into Merkle tree

##### `withdraw()` - Private Withdrawal
Processes private withdrawals using zk-SNARK proofs.

```solidity
function withdraw(
    uint[2] calldata a,
    uint[2][2] calldata b, 
    uint[2] calldata c,
    uint256 merkleRoot,
    uint256 nullifier,
    uint256 newCommitment,
    uint256 amount,
    address recipient,
    uint256 relayFee
) external whenNotPaused nonReentrant
```

**Parameters:**
- `a, b, c`: Groth16 proof components
- `merkleRoot`: Merkle root the proof is based on
- `nullifier`: Unique identifier preventing double-spending
- `newCommitment`: Commitment for change note
- `amount`: Withdrawal amount
- `recipient`: Withdrawal recipient address
- `relayFee`: Fee paid to relay service

**Validation Process:**
1. Check nullifier hasn't been used
2. Verify Merkle root is known (recent)
3. Verify zk-SNARK proof
4. Mark nullifier as used
5. Insert new commitment (change note)
6. Transfer funds to recipient and relay

#### `MerkleTree.sol` - Merkle Tree Implementation

Implements an incremental Merkle tree for storing note commitments.

**Constants:**
```solidity
uint256 public constant MERKLE_DEPTH = 30;      // Tree depth
uint256 public constant ROOTS_CAPACITY = 30;    // Root history size
```

**State Variables:**
```solidity
uint256 public currentLeafIndex;                // Current leaf count
uint256[ROOTS_CAPACITY] public roots;           // Circular buffer of roots
uint256 public currentRootIndex;                // Current root index
uint256[MERKLE_DEPTH] public zeroHashes;        // Cached zero hashes
uint256[MERKLE_DEPTH] public filledSubtrees;    // Rightmost left neighbor per level
```

**Key Functions:**

##### `insertLeaf(uint256 leaf)`
Inserts a new leaf (commitment) into the tree.

**Process:**
1. Update tree structure level by level
2. Compute new root using Poseidon hash
3. Store root in circular buffer
4. Emit `LeafInserted` event

##### `isKnownRoot(uint256 root)`
Checks if a root exists in recent history.

**Purpose:** This prevents scenarios where a user's withdrawal would fail if someone else makes a deposit between the user generating their proof and submitting their transaction, as new deposits change the Merkle root.

#### `WithdrawVerifier.sol` - zk-SNARK Verifier
This is a snarkjs-generated Groth16 verifier that handles proof verification.

## Security Features

### Access Control
- **Owner Functions**: Emergency pause, contract upgrades
- **User Functions**: Deposits and withdrawals
- **Relay Functions**: Can submit user transactions

### Reentrancy Protection
All state-changing functions use `nonReentrant` modifier to prevent reentrancy attacks.

### Pause Mechanism
Contract can be paused in emergency situations:
```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
```

### Nullifier Tracking
Prevents double-spending by tracking used nullifiers:
```solidity
mapping(uint256 => bool) public nullifierUsed;
```

### Root History
Maintains history of recent Merkle roots to allow proofs based on slightly outdated states:
- Circular buffer of 30 recent roots
- Prevents front-running attacks
- Provides user flexibility

## Deployment

> ⚙️ **For step-by-step deployment instructions, see [`contracts-evm/README.md`](../contracts-evm/README.md)**

## Testing

> 🧪 **For detailed testing commands and options, see [`contracts-evm/README.md`](../contracts-evm/README.md)**

## Security Considerations

### Current Status
✅ **Proper Groth16 Verifier**: Full verification implementation with assembly optimizations
✅ **Poseidon Hash**: Consistent hash function between contracts and circuits
✅ **Nullifier Protection**: Prevents double-spending attacks
✅ **Reentrancy Guards**: Protection against reentrancy attacks

### Production Requirements

#### 1. Trusted Setup
Conduct proper trusted setup ceremony:
- Multi-party computation
- Transparent process
- Verification of parameters

#### 2. Security Audit
Professional security audit covering:
- Smart contract vulnerabilities
- Circuit correctness
- Integration issues

#### 3. Gas Optimization
Further optimize gas costs:
- Batch verification for multiple proofs
- Reduce storage operations

## Future Improvements

### Planned Enhancements
1. **Multi-Token Support**: Extend beyond ETH to ERC-20 tokens
2. **Batch Operations**: Process multiple deposits/withdrawals

### Upgrade Strategy
- Use proxy pattern for upgradability
- Implement timelock for critical changes
- Multi-sig governance for upgrade decisions
- Gradual migration for major changes
