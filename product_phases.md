# Product Roadmap – Cipherpay
---

## **Product 0 — Basic Shielded Transactions**

### **Deposit**

* User visits the website and clicks **“Deposit”**.
* A secret note is generated: `(note_randomness, secret_key)`.
* The user is prompted to **download the note** and store it securely.
* Then, the deposit transaction is submitted to the protocol.

### **Withdrawal**

* User clicks **“Withdraw”**.
* They are prompted to upload the previously saved secret note.
* They input:

  * **Withdrawal amount**
  * **Withdrawal address**
* The interface displays a **relay fee** that will be subtracted from the withdrawal amount.
* If the withdrawal does not consume the full note, a **new secret note is generated** for the remaining balance.
* A **zk proof is generated in-browser**.
* The transaction is sent to a **relay**, which submits it on-chain.

---


## **Product 1 — Multi-Note, Multi-Output Withdrawals**

### **Upgraded Withdrawals**

* Support for:

  * **Multiple notes as inputs**
  * **Multiple outputs (addresses and amounts)**
* Users can split their funds across destinations in a single transaction.
* The UI supports note selection and manual splitting.

### **Wallet Extension / Mobile App**

* Introduce a companion **wallet extension or mobile app**.
* Manages:
  * Note storage
* Users no longer need to manually download or manage note files.

---

## **Product 2 — P2P Private Transfers**

### **Shielded Identity Layer**

* Each wallet is initialized with a **seed phrase** that deterministically generates:

  * A **spending key**
  * A **viewing key**
* These keys are used to:

  * Create notes
  * Encrypt/decrypt note ciphertexts

### **Incoming Transfer Detection**

* Notes now include an **encrypted ciphertext**.
* Wallets scan the chain for on-chain ciphertexts emitted by transactions.
* If a ciphertext decrypts successfully, the wallet knows it received a note.

### **P2P Sending Flow**

* User clicks **“Send P2P”**
* Enters the **recipient’s viewing key**
* Selects the notes to use and the amount to send
* A zk proof is generated and submitted to a **relay**
* The receiving user’s wallet:

  * Detects the transaction
  * Successfully decrypts the ciphertext
  * Adds the received note to the user’s balance

> Privacy: No external observer can link sender, recipient, or amount. Only on-chain data is commitments and ciphertexts.

---


## **Product 3 — Shielded AMM**

### **Concept (WIP)**

* Users can **privately swap tokens** inside the protocol.
* Multiple token pools exist with **public price ratios**.
* Users provide liquidity between tokens by depositing shielded liquidity notes.
* A zk proof is generated that:

  * Verifies correct input/output balance
  * Enforces the swap ratio
  * Keeps sender identity and balances private

> Third parties see only that a swap occurred — not who swapped.

---


## Experimental & Future Products

---

### **Product 4 — Timed Escrows & Conditional Notes**

Enable smart conditions on shielded outputs:

* **Time-locks**: Notes become spendable only after a specific block height or timestamp.
* **Custom ZK conditions**: Notes can be spent only if a zk condition is satisfied.

  * Example: zk-email receipt, zk-password proof, or proving external commitments.
* Use cases:

  * Delayed payments
  * Non-custodial escrow
  * Sealed bid auctions

---

### **Product 5 — Anonymity Mining & Private Reputation**

Introduce anonymous incentives:

* Users earn **shielded reputation points** for actions like:

  * Depositing
  * Relaying transactions
  * Providing liquidity (in future AMM)
* Reputation is **unlinkable** to identity.
* Points can be **redeemed for rewards** or used in governance — provable without doxing.

---

### **Product 6 — Private Voting & Governance**

Let shielded token holders vote privately:

* Vote weight = value of shielded note
* Prove:

  * Note ownership
  * Valid range (e.g., quadratic voting cap)
* Without revealing:

  * Who voted
  * How they voted
  * Their total balance
* Useful for:

  * Protocol governance
  * Anonymous DAOs
  * Sybil-resistant decision-making

---

### **Product 7 — Integration with Privacy-Preserving DIDs**

Link shielded notes with decentralized identity in a zero-knowledge way:

* Notes include **encrypted DID tags** or claims
* Off-chain resolver or verifier uses ZKPs to:
  * Prove ownership of the note
  * Prove attributes like "KYC passed", "verified developer", ">=18" without revealing full identity
* Enables:
  * Anonymous access control
  * Proof-of-credentials
  * Compliance-friendly privacy
