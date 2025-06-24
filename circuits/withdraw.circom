pragma circom 2.2.0;
include "./note_commitment.circom";
include "./nullifier.circom";
include "./merkle_proof.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Parameters

template Withdraw(MERKLE_DEPTH) {
    // public inputs
    signal input merkle_root;
    signal input withdraw_amount;
    signal input recipient;
    signal input relay_fee;

    // Private note inputs
    signal input note_amount;
    signal input note_randomness;
    signal input note_secret_key;

    signal input new_note_randomness;
    signal input new_note_secret_key;

    // Merkle path
    signal input merkle_path_elements[MERKLE_DEPTH];
    signal input merkle_path_indices[MERKLE_DEPTH];

    signal output nullifier;
    signal output new_commitment;

    // 1. Check nullifier
    nullifier <== Nullifier()(note_secret_key, note_randomness);

    // 2. Check note commitment
    signal note_pubkey <== Poseidon(1)([note_secret_key]);
    signal commitment <== NoteCommitment()(note_amount, note_randomness, note_pubkey);

    // 3. Merkle proof
    component merkle = MerkleProof(MERKLE_DEPTH);
    merkle.leaf <== commitment;
    merkle.root <== merkle_root;
    for (var i = 0; i < MERKLE_DEPTH; i++) {
        merkle.path_elements[i] <== merkle_path_elements[i];
        merkle.path_indices[i] <== merkle_path_indices[i];
    }
    merkle.is_valid === 1;

    signal note_amount_bits[252] <== Num2Bits(252)(note_amount);
    signal withdraw_amount_bits[252] <== Num2Bits(252)(withdraw_amount);
    signal relay_fee_bits[252] <== Num2Bits(252)(relay_fee);

    signal note_amount_less_than_withdraw_amount <== LessThan(252)([note_amount, withdraw_amount]);
    signal note_amount_less_than_relay_fee <== LessThan(252)([note_amount, relay_fee]);
    note_amount_less_than_withdraw_amount === 0;
    note_amount_less_than_relay_fee === 0;

    signal withdrawTotal <== withdraw_amount + relay_fee;
    signal note_amount_less_than_withdraw_total <== LessThan(252)([note_amount, withdrawTotal]);
    note_amount_less_than_withdraw_total === 0;

    signal new_amount <== note_amount - withdrawTotal;
    signal new_pubkey <== Poseidon(1)([new_note_secret_key]);
    new_commitment <== NoteCommitment()(new_amount, new_note_randomness, new_pubkey);

    signal relayFeeSquared;
    relayFeeSquared <== relay_fee * relay_fee;

    signal recipientSquared;
    recipientSquared <== recipient * recipient;

    signal withdrawAmountSquared;
    withdrawAmountSquared <== withdraw_amount * withdraw_amount;
}

component main {public [merkle_root, withdraw_amount, recipient, relay_fee]} = Withdraw(30); 