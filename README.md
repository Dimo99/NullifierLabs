# 🔐 CipherPay - Zero-Knowledge Private Mixer

A privacy protocol that enables private transactions on Ethereum using zero-knowledge proofs. Deposit ETH, withdraw to any address while maintaining complete privacy.

## What is CipherPay?

CipherPay is a **privacy mixer** that breaks the link between deposits and withdrawals using zero-knowledge cryptography. Users can:

1. **Deposit ETH** with a secret commitment
2. **Withdraw privately** to any address using zk-SNARK proofs
3. **Maintain anonymity** - no one can link deposits to withdrawals

## How It Works

### Deposit Flow
1. Generate a secret key using mouse entropy
2. Compute commitment = `Poseidon(amount, publicKey)`
3. Send ETH + commitment to the mixer contract
4. Your funds are now private!

### Withdrawal Flow
1. Input your secret key
2. Specify withdrawal amount and recipient
3. Generate a zero-knowledge proof that you own a valid note
4. Submit proof + withdrawal - no one knows which deposit it came from

## Key Features

- ✅ **Private Transactions** - Deposits and withdrawals are unlinkable
- ✅ **Arbitrary Amounts** - Any amount, not fixed denominations
- ✅ **Partial Withdrawals** - Withdraw part of your deposit, keep the rest
- ✅ **Zero-Knowledge Proofs** - Prove ownership without revealing secrets
- ✅ **Web Interface** - Easy-to-use frontend application

## Technology Stack

- **Smart Contracts**: Solidity with Foundry (EVM-compatible)
- **Zero-Knowledge**: Circom circuits with Groth16 proofs
- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Express.js for event indexing and API
- **Cryptography**: Poseidon hash, BN254 curve, 30-level Merkle trees

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Foundry (for contracts)

### Setup
```bash
# Clone and install
git clone <repository-url>
cd private_mixer

# Install root dependencies
npm install

# Install dependencies for each component
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd contracts-evm && forge install && cd ..
```

### Run Locally
```bash
# 1. Start local blockchain (Terminal 1)
cd contracts-evm
anvil

# 2. Deploy contracts (Terminal 2)
cd contracts-evm
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # Default Anvil key
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key $PRIVATE_KEY --broadcast

# 3. Start backend (Terminal 3)
cd backend
npm run dev

# 4. Start frontend (Terminal 4)
cd frontend
npm run dev

# 5. Open http://localhost:3000 in your browser
```

### First Deposit & Withdrawal
1. **Connect Wallet**: Use MetaMask with Anvil's local network (Chain ID: 31337)
2. **Add Test ETH**: Anvil provides test accounts with ETH
3. **Make Deposit**: Generate a secret key and deposit ETH
4. **Save Note**: Save your secret note file securely
5. **Withdraw**: Upload your note and withdraw to any address

## 🧪 Testing

```bash
# Test circuits
npm test

# Test contracts
cd contracts-evm && forge test

# Test integration
npm run test:integration
```

## 📁 Project Structure

```
private_mixer/
├── circuits/           # Zero-knowledge circuits (Circom)
├── contracts-evm/      # Smart contracts (Solidity + Foundry)
├── frontend/           # Web app (Next.js + TypeScript)
├── backend/            # API server (Express.js)
└── docs/              # Documentation
```

## ⚠️ Important Notice

**This is experimental software for development and testing only.**

🚨 **DO NOT USE WITH REAL FUNDS** 🚨

### What's Working
- ✅ Full zk-SNARK proof system
- ✅ Groth16 verifier implementation
- ✅ Poseidon hash integration
- ✅ Complete web interface

### Before Production
- [ ] Trusted setup ceremony
- [ ] Professional security audit
- [ ] Comprehensive testing
- [ ] Gas optimization

## �📚 Learn More

- [Technical Details](private_mixer.md)
- [Product Roadmap](product_phases.md)
- [Circuit Documentation](docs/circuits.md)
- [Contract Documentation](docs/contracts.md)
