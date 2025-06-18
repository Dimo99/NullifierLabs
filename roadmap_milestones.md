### **Phase 0: zk Stack Selection & Circuit Prototyping** *(1 month)*

**Goals:**

* Review prior art (e.g., Tornado Nova)
* Finalize zk circuit architecture
* Select/benchmark zk backend (`circom`, `Cairo`, `Risc0`, `Noir`)

  * Must support mobile/browser proving
  * Should have Solana verifier contract
* Implement base circuits:

  * Merkle inclusion
  * Nullifier uniqueness
  * Balance preservation (`in = out + withdrawal`)
* Local test harness

**Deliverables:**

* zk circuit prototypes
* Test vectors
* JS wrapper for local proving

### **Phase 1: Deposit & Withdrawal MVP** *(2 months)*

**Goals:**

* Solana smart contract:

  * Merkle tree handling
  * zk proof verification
  * Nullifier tracking
  * Public withdrawals
* CLI wallet:

  * Note generation
  * zk proof generation
  * Submit tx via relay (user sends signed tx data, relay broadcasts to Solana)

**Deliverables:**

* End-to-end flow: deposit 1 SOL → withdraw 0.4 SOL
* Rust/TS CLI wallet

### **Phase 2: Change Notes & Multi-Output Support** *(1 month)*

**Goals:**

* Add support for change notes in withdrawal
* zk circuit: multiple outputs per tx
* CLI wallet tracks UTXOs internally

**Deliverables:**

* Circuit update for multi-output
* CLI wallet with balance tracking
* Demo: "withdraw 0.4, keep 0.6 in mixer"


### **Phase 3: Wallet UI (Extension + Mobile)** *(2 months)*
**Goals:**
* Browser wallet extension
  * Note mgmt, Merkle sync, proof gen
* Mobile app (optional MVP)
* Integrate relay selection and fee display

**Deliverables:**

* Browser extension MVP
* Optional mobile wallet

### **Phase 4: Audit & Launch Prep** *(1–1.5 months)*

**Goals:**

* zk circuit & contract audits
* Launch with capped pool
* Bug bounty campaign

**Deliverables:**

* Audit results
* Mainnet deployment
* Docs for public use

### **Phase 5: Ciphertexts & Note Scanning (Optional / Post-MVP)**

**Goals:**

* Add ciphertext encryption (note metadata)
* Emit ciphertexts (logs or storage)
* Note scanner: decrypt & track received notes

**Deliverables:**

* zk circuit update
* Encryption/decryption utils
* CLI and wallet UI scanner

### **Phase 6: Ecosystem Engagement & Community Growth** *Ongoing*

**Goals:**

* Present early MVP and roadmap to:

  * Solana Foundation (grants + visibility)
  * zkHack, ZK Summit, zkDay
  * Privacy-centric ecosystems (ZeroKnowledge.fm, Nym, Anoma, Aztec)
* Share learnings via:

  * Blog posts and/or whitepaper
  * Open-source GitHub repo
* Engage early users for feedback
* Connect with Solana wallets for integration (e.g., Backpack, Nightly)

**Deliverables:**

* Project website & whitepaper
* Conference talks or workshops
* Open-source release & tutorials