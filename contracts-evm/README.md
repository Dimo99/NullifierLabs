# Private Mixer - EVM Contracts

This directory contains the EVM smart contracts for the Private Mixer protocol, a zero-knowledge based privacy solution for Ethereum and other EVM-compatible blockchains.

> 📖 **For complete contract documentation, API reference, and security details, see [`docs/contracts.md`](../docs/contracts.md)**

## Quick Start

### Prerequisites
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Setup
```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test
```

### Deployment

1. Set your private key:
```bash
export PRIVATE_KEY=your_private_key_here
```

2. Deploy to local testnet:
```bash
# Start Anvil
anvil

# Deploy (new terminal)
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key $PRIVATE_KEY --broadcast
```

3. Deploy to testnet/mainnet:
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
```

## Basic Usage

### Deposit Example
```solidity
// Generate commitment off-chain
uint256 pubkey = poseidon.poseidon([secretKey]);
uint256[2] memory inputs = [amount, pubkey];
uint256 commitment = poseidon.poseidon(inputs);

// Deposit ETH
mixer.deposit{value: amount}(pubkey);
```

### Withdrawal Example
```solidity
// Generate zk-SNARK proof off-chain using circuits
// Then submit withdrawal
mixer.withdraw(
    proof.a, proof.b, proof.c,
    nullifier, newCommitment, merkleRoot,
    amount, recipient, relayFee
);
```

## Core Contracts

- **`PrivateMixer.sol`** - Main mixer contract (deposits, withdrawals, nullifiers)
- **`MerkleTree.sol`** - Incremental Merkle tree for commitments  
- **`WithdrawVerifier.sol`** - Groth16 zk-SNARK verifier
- **`PoseidonByteCodes.sol`** - Poseidon hash implementation

## Circuit Integration

The contracts work with circuits in `../circuits/`:
- `withdraw.circom` - Main withdrawal circuit
- `note_commitment.circom` - Commitment computation  
- `nullifier.circom` - Nullifier computation
- `merkle_proof.circom` - Merkle proof verification

### Generating Proofs
```bash
cd ../circuits
npm run test:withdraw  # Test circuit
# Use snarkjs for proof generation in production
```

## Testing & Development

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test testDeposit

# Run with verbose output
forge test -vvv
```

## Important Notes

⚠️ **This is experimental software for development only**
- Do not use with real funds
- Requires trusted setup ceremony for production
- Needs professional security audit

## Documentation

- **Complete API Reference**: [`docs/contracts.md`](../docs/contracts.md)
- **Circuit Documentation**: [`docs/circuits.md`](../docs/circuits.md)
- **Project Overview**: [`README.md`](../README.md)

## Contributing

1. Update circuits first if needed
2. Modify contracts to match
3. Add comprehensive tests
4. Update documentation
5. Follow Solidity style guide
