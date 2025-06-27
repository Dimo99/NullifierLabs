# Cipherpay - Technical Specification

## Overview

This specification defines a zero-knowledge-based private mixer protocol for Solana. The goal is to allow users to deposit a fixed or arbitrary amount of SOL (or SPL tokens) into a shielded pool, and withdraw any amount later to a public address while maintaining privacy. Withdrawals are unlinkable to deposits using zk-SNARK or zk-STARK proofs.

Unlike Tornado Cash-style mixers, this protocol supports:

* Arbitrary amounts
* Multiple withdrawals from a single deposit
* Change notes
* Hidden note ownership
* Shielded-to-shielded internal transfers (fully private payments within the pool)

The system uses UTXO-style shielded notes and a Merkle tree of commitments to represent unspent funds.

---

## Terminology

* **Note**: A private UTXO containing amount, secret key, and derived public key.
* **Commitment**: A cryptographic commitment to a note, stored in a Merkle tree.
* **Nullifier**: A unique identifier derived from a note, revealed when the note is spent.
* **Stealth Address**: A public key generated from a user's secret key for receiving shielded notes.
* **Circuit**: A zero-knowledge circuit proving correctness of a spend or deposit without revealing inputs.
* **Ciphertext**: Encrypted note metadata sent alongside a commitment, enabling receivers to detect incoming notes.
* **Relay**: A third-party actor that broadcasts user-generated transactions to Solana on their behalf. Relays prevent the user’s public key from appearing on-chain, preserving sender anonymity. They may charge a small relay fee, embedded in the transaction logic and proven inside the zk circuit.

---

## System Components

### On-chain Program (Solana Smart Contract)

* Stores the Merkle tree root of all commitments
* Verifies zero-knowledge proofs
* Maintains a set of used nullifiers to prevent double-spending
* Handles deposits, withdrawals, and internal shielded transfers
* Emits ciphertexts (encrypted note data) for receivers
* Validates that the output includes a relay fee (if declared)
* Can optionally restrict direct user submission to force relay usage (configurable)

### Off-chain Components

* **Wallet**
    * note generation, zk proof generation, and transaction signing
    * Note scanner that listens for ciphertexts and decrypts them using the user's viewing key
* **Relay node**
    * Broadcasts transactions for users
    * Collects predefined fee
    Security Considerations
#### Security considerations
* Relay trust model:
    * Users don’t need to trust relays with funds or keys — only with liveness
    * Worst-case: relay censors or delays a tx (user can retry with another)
---

## Workflow

### Deposit

1. User generates a note: `(amount, secret_key)`
2. Derives public key: `pubkey = Poseidon(secret_key)`
3. Computes commitment: `C = Poseidon(amount, pubkey)`
4. Sends on-chain tx with `C` and funds (SOL/SPL)
5. Contract appends `C` to Merkle tree

### Withdrawal (Spend + Optional Change)

1. User selects a note
2. Generates zk proof with:
   * Merkle inclusion proof for the note's commitment
   * Knowledge of `secret_key`
   * Knowledge of `pubkey = Poseidon(secret_key)`
   * Derivation of `nullifier = Poseidon(secret_key, commitment)`
   * Valid recipient address for withdrawal
   * Change note commitment
   * Encrypted note data (ciphertexts) for outputs
3. Sends on-chain tx with:
   * `nullifier[]`
   * `new_commitments[]` (change notes and shielded outputs)
   * `ciphertexts[]` (encrypted metadata for each output note)
   * `zk_proof`
   * `withdrawal_amount`
4. Contract verifies:
   * `zk_proof` is valid
   * `nullifiers[]` havent been used
   * `new_commitments` added to Merkle tree
   * Transfers `withdrawal_amount` to public address



### Shielded Transfer (Internal Transfer)

1. Sender generates two output notes:
   * One for the recipient: `(amount, recipient_secret_key)` → `pubkey = Poseidon(recipient_secret_key)` → `commitment = Poseidon(amount, pubkey)`
   * One for change back to self
2. For each output note, encrypts the metadata:
   * `ciphertext = Encrypt(recipient_viewing_key, secret_key, amount [, optional memo])`
3. Generates zk proof that:
   * Input note(s) are valid and unspent
   * Nullifier(s) are correctly derived and unique
   * Sum of inputs = sum of outputs

4. Sends on-chain tx with:
   * `nullifiers[]`
   * `new_commitments[]`
   * `ciphertexts[]`
   * `zk_proof`

5. Contract:
   * Adds new commitments to Merkle tree
   * Emits ciphertexts (for scanning by recipients)
   * No public transfer of tokens occurs (purely internal movement)

6. Receiver (off-chain):
   * Scans ciphertexts using their viewing key
   * If decryption succeeds, note is stored in their wallet as spendable

---

## Future Extensions

* Private token swaps within the mixer
