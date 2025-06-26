pragma circom 2.2.0;
include "../node_modules/circomlib/circuits/poseidon.circom";

// Computes N = Poseidon(secret_key, commitment)
template Nullifier() {
    signal input secret_key;
    signal input commitment;
    signal output nullifier;

    nullifier <== Poseidon(2)([secret_key, commitment]);
}

// component main = Nullifier(); 