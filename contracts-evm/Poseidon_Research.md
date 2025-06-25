# Poseidon Solidity Implementation Analysis

## Overview
Research comparing different Poseidon hash implementations for integration with our zkSNARK private mixer protocol.

## Implementations Compared

### 1. chancehudson/poseidon-solidity (Yul-based)
**Source**: https://github.com/chancehudson/poseidon-solidity

#### Features:
- Pure Yul assembly implementation for maximum gas efficiency
- Variants: T2, T3, T4, T5, T6 (supporting 1-5 inputs respectively)
- Optimized for BN254 finite field operations
- Compatible with Circom circuits

#### Gas Costs (Execution):
- T2: 13,488 gas (1 input)
- T3: 21,124 gas (2 inputs) ⭐ **Most relevant for mixer**
- T4: 37,617 gas (3 inputs)
- T6: 74,039 gas (5 inputs)

#### Deployment Costs:
- T3: 5,129,638 gas (high deployment cost)

#### Pros:
- ✅ 30-35% lower execution gas costs vs circomlibjs
- ✅ Yul assembly optimization
- ✅ Direct BN254 field compatibility
- ✅ Multiple arity support

#### Cons:
- ❌ **Not audited** (security risk for production)
- ❌ High deployment costs
- ❌ Complex assembly code (harder to audit)

### 2. iden3/circomlibjs (Official)
**Source**: https://github.com/iden3/circomlibjs

#### Features:
- Official implementation from Circom team
- Generated via `poseidon_gencontract.js`
- Direct compatibility with circomlib circuits
- Battle-tested in production (Tornado Cash, Semaphore)

#### Gas Costs (Execution):
- T2: 19,395 gas
- T3: 32,173 gas (2 inputs)
- T4: 48,267 gas (3 inputs)
- T6: 100,197 gas (5 inputs)

#### Deployment Costs:
- T3: 2,156,516 gas (58% lower than poseidon-solidity)

#### Pros:
- ✅ **Official implementation** (trust & compatibility)
- ✅ Battle-tested in major protocols
- ✅ Lower deployment costs
- ✅ Better auditability
- ✅ Direct circomlibjs integration

#### Cons:
- ❌ 30-35% higher execution gas costs
- ❌ Less optimized assembly

## Recommendations for Private Mixer

### Primary Recommendation: **iden3/circomlibjs**

**Rationale:**
1. **Security First**: Official implementation with proven track record
2. **Circuit Compatibility**: Guaranteed compatibility with our Circom circuits
3. **Production Ready**: Used in Tornado Cash and Semaphore
4. **Lower Deployment Cost**: 58% less gas for deployment
5. **Maintainability**: Standard implementation, easier to audit

### Circuit Requirements Analysis

Our withdrawal circuit uses Poseidon in these contexts:
```circom
// 1. Public key derivation (1 input)
signal note_pubkey <== Poseidon(1)([note_secret_key]);

// 2. Note commitment (3 inputs) 
commitment <== NoteCommitment()(note_amount, note_randomness, note_pubkey);

// 3. Nullifier (2 inputs)
nullifier <== Nullifier()(note_secret_key, note_randomness);

// 4. Merkle tree hashing (2 inputs)
cur[i+1] <== Poseidon(2)([left[i], right[i]]);
```

**Required Variants:**
- **PoseidonT2** (1 input): Public key derivation
- **PoseidonT3** (2 inputs): Nullifiers, Merkle tree ⭐ **Most used**
- **PoseidonT4** (3 inputs): Note commitments

### Implementation Plan

1. **Use circomlibjs generator** for PoseidonT2, T3, T4
2. **Generate contracts** during circuit build process
3. **Integrate with existing** `generate_verifier.ts` script
4. **Create wrapper library** for type-safe usage

### Gas Cost Impact

For typical mixer operations:
- **Deposit**: 1x T4 hash (~48k gas)
- **Withdraw**: 1x T2 + 1x T3 + 30x T3 (Merkle path) ≈ ~1M gas for hashing
- **Total additional cost**: ~50k gas vs keccak256

This is acceptable for privacy-preserving transactions.

### Future Optimization

Monitor **EIP-5988** (Poseidon precompile) which would reduce costs to ~200 gas per hash.

## Security Considerations

1. **Use official circomlibjs** for production security
2. **Ensure hash consistency** between circuits and contracts
3. **Test thoroughly** with actual circuit outputs
4. **Consider audit** of generated contracts

## Conclusion

**Recommended**: Use `iden3/circomlibjs` generated contracts for security and compatibility, accept the 30% gas overhead as a reasonable cost for privacy and security guarantees.