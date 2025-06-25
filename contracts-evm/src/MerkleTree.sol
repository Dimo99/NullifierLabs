// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPoseidon.sol";

/**
 * @title MerkleTree
 * @dev Incremental Merkle tree implementation using Poseidon hash function
 */
contract MerkleTree {
    
    uint256 public constant MERKLE_DEPTH = 30;
    uint256 public constant ROOTS_CAPACITY = 30;
    
    IPoseidon2 public immutable poseidon;
    
    // Current number of leaves in the tree
    uint256 public currentLeafIndex;
    
    // Circular buffer for storing recent roots
    uint256[ROOTS_CAPACITY] public roots;
    uint256 public currentRootIndex;
    
    // Cached zero hashes for each level to avoid recomputation
    uint256[MERKLE_DEPTH] public zeroHashes;
    
    // Filled subtrees - stores the rightmost hash at each level
    uint256[MERKLE_DEPTH] public filledSubtrees;
    
    error MerkleTreeFull();
    
    event LeafInserted(uint256 indexed leafIndex, uint256 leaf, uint256 newRoot);
    
    constructor(address _poseidon) {
        require(_poseidon != address(0), "Invalid Poseidon address");
        poseidon = IPoseidon2(_poseidon);
        _initializeZeroHashes();
    }
    
    /**
     * @dev Initialize zero hashes for each level
     */
    function _initializeZeroHashes() internal {
        zeroHashes[0] = 0;
        
        for (uint256 i = 1; i < MERKLE_DEPTH; i++) {
            uint256[2] memory inputs = [zeroHashes[i-1], zeroHashes[i-1]];
            zeroHashes[i] = poseidon.poseidon(inputs);
        }
        
        // Initialize filled subtrees with zero hashes (empty tree)
        for (uint256 i = 0; i < MERKLE_DEPTH; i++) {
            filledSubtrees[i] = zeroHashes[i];
        }

        roots[0] = zeroHashes[MERKLE_DEPTH - 1];
    }
    
    /**
     * @dev Insert a new leaf into the Merkle tree
     * @param leaf The leaf value to insert
     * @return newRoot The new Merkle root after insertion
     */
    function insertLeaf(uint256 leaf) internal returns (uint256 newRoot) {
        if (currentLeafIndex >= (1 << MERKLE_DEPTH)) {
            revert MerkleTreeFull();
        }
        
        uint256 current = leaf;
        uint256 index = currentLeafIndex;
        
        for (uint256 i = 0; i < MERKLE_DEPTH; i++) {
            if ((index & 1) == 0) {
                // Current position is left child
                // Store the current hash and hash with zero for the right sibling
                filledSubtrees[i] = current;
                uint256[2] memory inputs = [current, zeroHashes[i]];
                current = poseidon.poseidon(inputs);
            } else {
                // Current position is right child
                // Hash with the stored left sibling and update the filled subtree
                uint256[2] memory inputs = [filledSubtrees[i], current];
                current = poseidon.poseidon(inputs);
                filledSubtrees[i] = current;
            }
            index >>= 1;
        }
        
        roots[currentRootIndex] = current;
        currentRootIndex = (currentRootIndex + 1) % ROOTS_CAPACITY;
        
        currentLeafIndex++;
        
        return current;
    }

    /**
     * @dev Check if a root exists in the recent history
     * @param root The root to check
     * @return True if the root exists in history
     */
    function isKnownRoot(uint256 root) public view returns (bool) {
        for (uint256 i = 0; i < ROOTS_CAPACITY; i++) {
            if (roots[i] == root) {
                return true;
            }
        }
        return false;
    }
}