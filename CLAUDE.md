# CLAUDE.md

Codebase guidance for Claude Code (claude.ai/code) when working with the Cipherpay private mixer protocol.

## Project Overview

Zero-knowledge private mixer protocol enabling anonymous blockchain transactions using zk-SNARKs. Components:
- **circuits/** - Circom zk-SNARK circuits (withdraw, note_commitment, nullifier, merkle_proof)
- **contracts-evm/** - Solidity contracts with Groth16 verifier (Foundry)
- **frontend/** - Next.js 15 app with MetaMask integration
- **backend/** - Express API for Merkle tree state and event indexing
- **shared/** - Published as `@private-mixer/shared` npm package

## Critical Setup Requirements

### Build Order (Important!)
```bash
# 1. Install all dependencies
npm install

# 2. Build shared library first (required by frontend/backend)
cd shared && npm run build && cd ..

# 3. Then build other components as needed
```

### Circuit Compilation Process

**Custom test framework using direct circom commands:**
- Uses `CircuitTestRunner` in `circuits/scripts/circuit-test-runner.ts`
- Compilation: `circom circuit.circom --r1cs --wasm --sym --O2 -o outputs/`
- Trusted setup: `snarkjs groth16 setup` with Powers of Tau file
- Each test: witness generation → proof generation → verification
- No circom_tester - uses raw circom CLI execution

**Test outputs in `circuits/scripts/outputs/` with subdirectories for each circuit**

### Non-Obvious Configurations

**Backend uses parent tsconfig.json:**
- All backend npm scripts reference `../tsconfig.json`
- Start script runs from parent directory: `cd .. && node dist/backend/src/index.js`

**Foundry optimizations enabled:**
- `via_ir = true` - Uses Solidity IR pipeline
- `ffi = true` - External program calls in tests
- Gas limit: `9223372036854775807` (max int64)

**Incomplete workspace setup:**
- Only `shared` is in npm workspaces array
- Frontend/backend use local file references: `"@private-mixer/shared": "file:../shared"`

## Key Technical Details

- **UTXO Model**: Notes contain (amount, secret_key, derived_public_key)
- **Merkle Tree**: 30 levels, up to 2^30 notes
- **Hash Functions**: Poseidon (circuits) / Keccak256 (contracts - temporary)
- **Nullifiers**: Prevent double-spending via secret_key + commitment
- **Frontend**: Tailwind v4 alpha, React 19, in-browser proof generation

## Project-Specific Commands

```bash
# Circuit integration tests (from root)
npm test
npm run test:integration

# Individual circuit tests (debugging)
npm run test:nullifier
npm run test:note-commitment
npm run test:merkle-proof
npm run test:withdraw

# Deploy contracts
cd contracts-evm && forge script script/Deploy.s.sol
```

## Environment Variables

**Backend (.env):**
```
CONTRACT_ADDRESS=<address>
CONFIRMATIONS=<number>
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_CONTRACT_ADDRESS=<address>
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Task Management Workflow

When starting any non-trivial development task, follow this structured approach:

### 1. Create Implementation Plan
For any task requiring multiple steps or significant changes:
- Create a detailed plan in `tasks/<task-name>.md`
- Include objectives, analysis, implementation phases, and success criteria
- Use the following template structure:

```markdown
# Task Title

**Status:** In Progress  
**Date:** YYYY-MM-DD  

## Objectives
- Primary goals
- Secondary goals

## Analysis/Research Results
- Key findings
- Areas to change/modify

## Implementation Plan
### Phase 1: [Description]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Description]  
- [ ] Task 3
- [ ] Task 4

## Success Criteria
- Functional requirements
- Quality requirements

## Final Status
[Update when complete]
```

### 2. Execute Based on Plan
- Work through phases systematically
- Update plan file with progress (mark completed items)
- Document any changes or discoveries during implementation

### 3. Completion
- Rename file to `<task-name>.completed.md` when finished
- Update status to "✅ Completed"
- Document final results and outcomes

### Examples
- `tasks/code-refactoring-plan.completed.md` - Crypto function consolidation
- Use this pattern for features, refactoring, bug fixes, etc.

This approach ensures systematic execution and maintains project documentation.