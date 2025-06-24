pragma circom 2.2.0;
include "../node_modules/circomlib/circuits/poseidon.circom";

// Computes C = Poseidon(amount, note_randomness, pubkey)
template NoteCommitment() {
    signal input amount;
    signal input note_randomness;
    signal input pubkey;
    signal output commitment;

    commitment <== Poseidon(3)([amount, note_randomness, pubkey]);
}

// component main = NoteCommitment(); 