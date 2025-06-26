pragma circom 2.2.0;
include "../node_modules/circomlib/circuits/poseidon.circom";

// Computes C = Poseidon(amount, pubkey)
template NoteCommitment() {
    signal input amount;
    signal input pubkey;
    signal output commitment;

    commitment <== Poseidon(2)([amount, pubkey]);
}

// component main = NoteCommitment(); 