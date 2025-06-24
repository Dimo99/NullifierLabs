// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MerkleTree
 * @dev Library for Merkle tree operations
 */
library MerkleTree {
    
    /**
     * @dev Compute the hash of two leaves
     * @param left The left leaf
     * @param right The right leaf
     * @return The hash of the two leaves
     */
    function hashPair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }
    
    /**
     * @dev Compute the Merkle root from a list of leaves
     * @param leaves The list of leaves
     * @return The Merkle root
     */
    function computeRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        require(leaves.length > 0, "Empty leaves array");
        
        if (leaves.length == 1) {
            return leaves[0];
        }
        
        bytes32[] memory currentLevel = leaves;
        
        while (currentLevel.length > 1) {
            bytes32[] memory nextLevel = new bytes32[]((currentLevel.length + 1) / 2);
            
            for (uint256 i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    nextLevel[i / 2] = hashPair(currentLevel[i], currentLevel[i + 1]);
                } else {
                    nextLevel[i / 2] = currentLevel[i];
                }
            }
            
            currentLevel = nextLevel;
        }
        
        return currentLevel[0];
    }
    
    /**
     * @dev Verify a Merkle proof
     * @param leaf The leaf to verify
     * @param path The Merkle path
     * @param pathIndices The indices indicating left/right for each path element
     * @param root The expected root
     * @return True if the proof is valid
     */
    function verifyProof(
        bytes32 leaf,
        bytes32[] memory path,
        uint256[] memory pathIndices,
        bytes32 root
    ) internal pure returns (bool) {
        require(path.length == pathIndices.length, "Path length mismatch");
        
        bytes32 current = leaf;
        
        for (uint256 i = 0; i < path.length; i++) {
            require(pathIndices[i] <= 1, "Invalid path index");
            
            if (pathIndices[i] == 0) {
                // Left child
                current = hashPair(current, path[i]);
            } else {
                // Right child
                current = hashPair(path[i], current);
            }
        }
        
        return current == root;
    }
    
    /**
     * @dev Generate a Merkle proof for a given leaf
     * @param leaves The list of all leaves
     * @param leafIndex The index of the leaf to generate proof for
     * @return path The Merkle path
     * @return pathIndices The indices indicating left/right for each path element
     */
    function generateProof(
        bytes32[] memory leaves,
        uint256 leafIndex
    ) internal pure returns (bytes32[] memory path, uint256[] memory pathIndices) {
        require(leafIndex < leaves.length, "Leaf index out of bounds");
        
        uint256 depth = 0;
        uint256 temp = leaves.length;
        while (temp > 1) {
            temp = (temp + 1) / 2;
            depth++;
        }
        
        path = new bytes32[](depth);
        pathIndices = new uint256[](depth);
        
        uint256 currentIndex = leafIndex;
        bytes32[] memory currentLevel = leaves;
        
        for (uint256 i = 0; i < depth; i++) {
            uint256 siblingIndex;
            uint256 parentIndex;
            
            if (currentIndex % 2 == 0) {
                // Left child
                siblingIndex = currentIndex + 1;
                pathIndices[i] = 0;
            } else {
                // Right child
                siblingIndex = currentIndex - 1;
                pathIndices[i] = 1;
            }
            
            if (siblingIndex < currentLevel.length) {
                path[i] = currentLevel[siblingIndex];
            } else {
                // Empty sibling
                path[i] = bytes32(0);
            }
            
            parentIndex = currentIndex / 2;
            
            // Compute next level
            bytes32[] memory nextLevel = new bytes32[]((currentLevel.length + 1) / 2);
            for (uint256 j = 0; j < currentLevel.length; j += 2) {
                if (j + 1 < currentLevel.length) {
                    nextLevel[j / 2] = hashPair(currentLevel[j], currentLevel[j + 1]);
                } else {
                    nextLevel[j / 2] = currentLevel[j];
                }
            }
            
            currentLevel = nextLevel;
            currentIndex = parentIndex;
        }
    }
    
    /**
     * @dev Insert a new leaf into the Merkle tree and return the new root
     * @param currentRoot The current Merkle root
     * @param newLeaf The new leaf to insert
     * @return The new Merkle root
     */
    function insertLeaf(bytes32 currentRoot, bytes32 newLeaf) internal pure returns (bytes32) {
        // For a simple implementation, we'll hash the current root with the new leaf
        // In a more sophisticated implementation, you'd maintain the full tree structure
        return hashPair(currentRoot, newLeaf);
    }
} 