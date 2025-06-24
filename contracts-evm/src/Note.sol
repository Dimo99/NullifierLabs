// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Note
 * @dev Library for handling notes in the private mixer
 */
library Note {
    
    /**
     * @dev Structure representing a private note
     */
    struct NoteData {
        uint256 amount;        // Amount of tokens in the note
        uint256 randomness;    // Randomness for the note commitment
        uint256 secretKey;     // Secret key for the note owner
    }
    
    /**
     * @dev Compute the commitment for a note
     * @param note The note data
     * @return The commitment hash
     */
    function computeCommitment(NoteData memory note) internal pure returns (bytes32) {
        // This should match the commitment computation in the circuit
        // C = Poseidon(amount, randomness, pubkey)
        // For now, we'll use a simple hash, but this should be replaced with Poseidon
        return keccak256(abi.encodePacked(
            note.amount,
            note.randomness,
            note.secretKey
        ));
    }
    
    /**
     * @dev Compute the nullifier for a note
     * @param note The note data
     * @return The nullifier hash
     */
    function computeNullifier(NoteData memory note) internal pure returns (bytes32) {
        // This should match the nullifier computation in the circuit
        // N = Poseidon(secret_key, randomness)
        // For now, we'll use a simple hash, but this should be replaced with Poseidon
        return keccak256(abi.encodePacked(
            note.secretKey,
            note.randomness
        ));
    }
    
    /**
     * @dev Compute the public key from a secret key
     * @param secretKey The secret key
     * @return The public key
     */
    function computePublicKey(uint256 secretKey) internal pure returns (uint256) {
        // This should match the public key computation in the circuit
        // pubkey = Poseidon(secret_key)
        // For now, we'll use a simple hash, but this should be replaced with Poseidon
        return uint256(keccak256(abi.encodePacked(secretKey)));
    }
    
    /**
     * @dev Create a new note
     * @param amount The amount of tokens
     * @param randomness The randomness for the commitment
     * @param secretKey The secret key for the note owner
     * @return The note data
     */
    function createNote(
        uint256 amount,
        uint256 randomness,
        uint256 secretKey
    ) internal pure returns (NoteData memory) {
        return NoteData({
            amount: amount,
            randomness: randomness,
            secretKey: secretKey
        });
    }
    
    /**
     * @dev Validate a note
     * @param note The note to validate
     * @return True if the note is valid
     */
    function isValid(NoteData memory note) internal pure returns (bool) {
        return note.amount > 0 && note.randomness != 0 && note.secretKey != 0;
    }
    
    /**
     * @dev Serialize a note to bytes
     * @param note The note to serialize
     * @return The serialized note
     */
    function serialize(NoteData memory note) internal pure returns (bytes memory) {
        return abi.encode(note.amount, note.randomness, note.secretKey);
    }
    
    /**
     * @dev Deserialize bytes to a note
     * @param data The serialized note data
     * @return The deserialized note
     */
    function deserialize(bytes memory data) internal pure returns (NoteData memory) {
        (uint256 amount, uint256 randomness, uint256 secretKey) = abi.decode(
            data,
            (uint256, uint256, uint256)
        );
        return NoteData({
            amount: amount,
            randomness: randomness,
            secretKey: secretKey
        });
    }
} 