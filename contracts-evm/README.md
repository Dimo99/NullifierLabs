# Private Mixer - EVM Contracts

This directory contains the EVM smart contracts for the Private Mixer protocol, a zero-knowledge based privacy solution for Ethereum and other EVM-compatible blockchains.

## Overview

The Private Mixer allows users to:
- Deposit funds into a shielded pool
- Withdraw funds to any address while maintaining privacy
- Use zk-SNARK proofs to prove ownership without revealing the underlying note
- Support relay services for enhanced privacy

## Architecture

### Core Contracts

1. **PrivateMixer.sol** - Main contract handling deposits, withdrawals, and nullifier management
2. **Verifier.sol** - zk-SNARK proof verification contract
3. **MerkleTree.sol** - Library for Merkle tree operations
4. **Note.sol** - Library for note structure and operations

### Key Features

- **Deposits**: Users can deposit ETH with a commitment hash
- **Withdrawals**: Users can withdraw funds using zk-SNARK proofs
- **Nullifier Management**: Prevents double-spending of notes
- **Merkle Tree**: Efficient commitment storage and verification
- **Relay Support**: Optional relay fees for enhanced privacy
- **Pausable**: Emergency pause functionality
- **Ownable**: Administrative controls

## Installation

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Deploy contracts
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY> --broadcast
```

## Usage

### Deployment

1. Set your private key as an environment variable:
```bash
export PRIVATE_KEY=your_private_key_here
```

2. Deploy the contracts:
```bash
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
```

### Deposit

```solidity
// Create a commitment for your note
// pubkey = Poseidon(secretKey)
// commitment = Poseidon(amount, pubkey)
uint256 pubkey = poseidon.poseidon([secretKey]);
uint256[2] memory inputs = [amount, pubkey];
uint256 commitment = poseidon.poseidon(inputs);

// Deposit funds
mixer.deposit{value: amount}(pubkey);
```

### Withdrawal

```solidity
// Generate zk-SNARK proof (off-chain)
// This requires the circuit and proving system

// Withdraw funds
mixer.withdraw(
    proof.a, proof.b, proof.c,
    publicInputs,
    nullifier,
    newCommitment,
    amount,
    recipient,
    relayFee
);
```

## Circuit Integration

The contracts are designed to work with the circom circuits in the `../circuits/` directory:

- `withdraw.circom` - Main withdrawal circuit
- `note_commitment.circom` - Note commitment computation
- `nullifier.circom` - Nullifier computation
- `merkle_proof.circom` - Merkle proof verification

### Proof Generation

To generate proofs for withdrawals:

1. Compile the circuits:
```bash
cd ../circuits
npm run compile
```

2. Generate proofs using snarkjs:
```bash
npm run prove
```

3. Use the generated proof in the withdrawal transaction.

## Security Considerations

### Current Limitations

1. **Verifier Implementation**: The current Verifier contract is a placeholder. In production, you need to:
   - Generate the actual verification key from the circuit
   - Implement proper Groth16 verification logic
   - Use a trusted setup ceremony

2. **Hash Functions**: The current implementation uses keccak256 for commitments and nullifiers. In production, you should:
   - Replace with Poseidon hash function to match the circuit
   - Use a proper implementation of the hash function

3. **Merkle Tree**: The current Merkle tree implementation is simplified. In production, you should:
   - Use a more efficient sparse Merkle tree
   - Implement proper tree updates
   - Add batch operations

### Best Practices

1. **Access Control**: The contract uses OpenZeppelin's Ownable for administrative functions
2. **Reentrancy Protection**: All external calls are protected against reentrancy attacks
3. **Pausable**: Emergency pause functionality for critical issues
4. **Input Validation**: Comprehensive input validation for all public functions

## Testing

Run the test suite:

```bash
# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test testDeposit

# Run with gas reporting
forge test --gas-report
```

## Gas Optimization

The contracts are optimized for gas efficiency:

- Use of libraries for common operations
- Efficient data structures
- Minimal storage operations
- Optimized function parameters

## Development

### Adding New Features

1. **Circuit Updates**: Update the circom circuits first
2. **Contract Updates**: Modify the smart contracts to match
3. **Test Updates**: Add comprehensive tests
4. **Documentation**: Update this README

### Code Style

- Follow Solidity style guide
- Use NatSpec documentation
- Include comprehensive error messages
- Add events for important state changes

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For questions and support:
- Open an issue on GitHub
- Check the documentation
- Review the test files for examples
