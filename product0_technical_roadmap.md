# 🛠️ Technical Roadmap – Product 0: Basic Shielded Transactions

### 🔧 Stack

* **ZK Circuit**: `circom`
* **Prover**: `snarkjs` (browser-based)
* **Verifier**: [`groth16-solana`](https://github.com/Lightprotocol/groth16-solana)
* **Frontend**: React + Wallet Adapter + snarkjs glue
* **Backend** (optional): Merkle indexer / relay
* **Solana Program**: Anchor or native Solana smart contract

---

## ✅ **Phase 0: Circuit Design & Prototyping**

**Goal**: Create working `circom` circuits and in-browser proof generation

### Tasks

* [ ] Define `Note` structure: `(amount, randomness, pubkey)`
* [ ] Circuit: `withdraw.circom`

  * Inputs:

    * Merkle root
    * Merkle path
    * Note secret (randomness + privkey)
    * Withdrawal amount
    * Recipient public address
  * Outputs:
    * Nullifier
    * New commitment
    * zk-SNARK proof
* [ ] JS wrapper for `snarkjs` in-browser proving
* [ ] Generate trusted setup (Groth16 ceremony)

### Deliverables

* [ ] `withdraw.r1cs`, `wasm`, `zkey`
* [ ] `withdraw.verifier.sol` (Solana-compatible using Lightprotocol toolchain)
* [ ] Static test vectors + CLI to simulate deposit → withdrawal → proof

---

## ✅ **Phase 1: Solana Smart Contract**

**Goal**: Deploy protocol logic on-chain

### Tasks

* [ ] Write Anchor smart contract (or native Solana)

  * State:

    * Merkle root
    * Used nullifiers
  * Handlers:

    * `deposit(commitment)`
    * `withdraw(nullifier, new_commitment, proof, amount, recipient)`
* [ ] Integrate verifier using `groth16-solana`
* [ ] Emit `NewCommitment` and `NullifierUsed` logs
* [ ] Optional: implement relayer-only mode (restrict direct txs)

### Deliverables

* [ ] Contract deployed on localnet/devnet
* [ ] Anchor IDL or native instructions

---

## ✅ **Phase 2: Frontend MVP**

**Goal**: End-to-end deposit and withdrawal via browser

### Deposit Flow

* [ ] User generates note (randomness + secret key)
* [ ] Commitment computed in-browser
* [ ] Submit tx with commitment + amount
* [ ] Note saved locally

### Withdrawal Flow

* [ ] User uploads note file
* [ ] UI fetches Merkle root + path

  * Option A: reconstruct from deposit events
  * Option B: use a backend indexer
* [ ] Enter amount + recipient address
* [ ] Generate zk proof in browser using `snarkjs`
* [ ] Send tx to relayer

### Deliverables

* [ ] React frontend with wallet connection
* [ ] Note download/upload support
* [ ] Fully working in-browser proof generation and tx submission

---

## ✅ **Phase 3: Relay Infrastructure**

**Goal**: Enable optional private tx broadcasting

### Tasks

* [ ] Basic relay node:

  * Accepts tx via API
  * Signs + sends to Solana on behalf of user
* [ ] Relay fee logic:

  * Fee embedded in proof circuit
  * Relay checks that it receives correct portion of withdrawal

### Deliverables

* [ ] Public API endpoint for relaying
* [ ] Frontend integration (fallback to direct tx if needed)