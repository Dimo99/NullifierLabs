pragma circom 2.2.0;
include "../node_modules/circomlib/circuits/poseidon.circom";

// Computes N = Poseidon(secret_key, note_randomness)
template Nullifier() {
    signal input secret_key;
    signal input note_randomness;
    signal output nullifier;

    nullifier <== Poseidon(2)([secret_key, note_randomness]);
}

// component main = Nullifier(); 