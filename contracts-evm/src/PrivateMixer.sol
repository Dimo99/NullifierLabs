// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./WithdrawVerifier.sol";
import "./IPoseidon.sol";

contract PrivateMixer is ReentrancyGuard, Pausable, Ownable {
    
    Groth16Verifier public immutable verifier;
    IPoseidon2 public immutable poseidon;
    
    uint256 public constant MERKLE_DEPTH = 30;
    
    uint256 public constant MERKLE_ROOT_HISTORY_SIZE = 10;
    
    uint256 public currentRootIndex;
    
    bytes32[MERKLE_ROOT_HISTORY_SIZE] public merkleRoots;
    
    bytes32[MERKLE_DEPTH] public merkleBranch;
    
    uint256 public currentLeafIndex;
    
    mapping(bytes32 => bool) public nullifierUsed;
    
    event Deposit(bytes32 indexed commitment, uint256 amount, address indexed depositor);
    event Withdrawal(
        bytes32 indexed nullifier,
        bytes32 indexed newCommitment,
        uint256 amount,
        address indexed recipient,
        uint256 relayFee
    );
    
    error InvalidVerifierAddress();
    error InvalidPoseidonAddress();
    error MerkleTreeFull();
    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidAmount();
    error InvalidRelayFee();
    error InsufficientBalance();
    error InvalidMerkleRoot();
    error MerkleRootNotFound();
    
    
    constructor(address _verifier, address _poseidon) Ownable(msg.sender) {
        if (_verifier == address(0)) {
            revert InvalidVerifierAddress();
        }

        if (_poseidon == address(0)) {
            revert InvalidPoseidonAddress();
        }

        verifier = Groth16Verifier(_verifier);

        poseidon = IPoseidon2(_poseidon);
        
        for (uint256 i = 0; i < MERKLE_ROOT_HISTORY_SIZE; i++) {
            merkleRoots[i] = bytes32(0);
        }
        currentRootIndex = 0;
        
        // Initialize Merkle branch with Poseidon hash of zeros
        uint256[2] memory zeroInputs = [uint256(0), uint256(0)];
        bytes32 zeroHash = bytes32(poseidon.poseidon(zeroInputs));
        for (uint256 i = 0; i < MERKLE_DEPTH; i++) {
            merkleBranch[i] = zeroHash;
        }
        currentLeafIndex = 0;
    }
    
    /**
     * @dev Calculate Merkle root from current branch and leaf index
     * @return The calculated Merkle root
     */
    function calculateMerkleRoot() internal view returns (bytes32) {
        bytes32 current = bytes32(0); // Start with zero leaf
        
        for (uint256 i = 0; i < MERKLE_DEPTH; i++) {
            if ((currentLeafIndex >> i) & 1 == 0) {
                // Current is left child
                uint256[2] memory inputs = [uint256(current), uint256(merkleBranch[i])];
                current = bytes32(poseidon.poseidon(inputs));
            } else {
                // Current is right child
                uint256[2] memory inputs = [uint256(merkleBranch[i]), uint256(current)];
                current = bytes32(poseidon.poseidon(inputs));
            }
        }
        
        return current;
    }
    
    /**
     * @dev Update Merkle branch when adding a new leaf
     * @param leaf The new leaf to add
     */
    function updateMerkleBranch(bytes32 leaf) internal {
        if (currentLeafIndex >= (1 << MERKLE_DEPTH)) {
            revert MerkleTreeFull();
        }

        bytes32 current = leaf;
        
        for (uint256 i = 0; i < MERKLE_DEPTH; i++) {
            if ((currentLeafIndex >> i) & 1 == 0) {
                // Current is left child, update branch[i] with right sibling
                merkleBranch[i] = current;
                uint256[2] memory inputs = [uint256(current), uint256(merkleBranch[i])];
                current = bytes32(poseidon.poseidon(inputs));
            } else {
                // Current is right child, update branch[i] with left sibling
                bytes32 temp = merkleBranch[i];
                merkleBranch[i] = current;
                uint256[2] memory inputs = [uint256(temp), uint256(current)];
                current = bytes32(poseidon.poseidon(inputs));
            }
        }
        
        currentLeafIndex++;
    }
    
    /**
     * @dev Deposit funds into the mixer
     * @param commitment The commitment hash of the note
     */
    function deposit(bytes32 commitment) external payable whenNotPaused {
        require(msg.value > 0, "Amount must be greater than 0");
        require(commitment != bytes32(0), "Invalid commitment");
        
        // Update Merkle branch with new commitment
        updateMerkleBranch(commitment);
        
        // Calculate new Merkle root
        bytes32 newRoot = calculateMerkleRoot();
        _updateMerkleRoot(newRoot);
        
        emit Deposit(commitment, msg.value, msg.sender);
    }
    
    /**
     * @dev Withdraw funds from the mixer using a zk-SNARK proof
     * @param a zk-SNARK proof component A
     * @param b zk-SNARK proof component B  
     * @param c zk-SNARK proof component C
     * @param nullifier The nullifier to prevent double-spending (must match proof)
     * @param newCommitment The commitment for the change note (must match proof)
     * @param merkleRoot The Merkle root being proven against (must match proof)
     * @param amount The amount to withdraw (must match proof)
     * @param recipient The recipient address (must match proof)
     * @param relayFee The fee for the relay service (must match proof)
     */
    function withdraw(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        bytes32 nullifier,
        bytes32 newCommitment, 
        bytes32 merkleRoot,
        uint256 amount,
        address recipient,
        uint256 relayFee
    ) external whenNotPaused nonReentrant {
        // Validate inputs
        require(amount > 0, "Amount must be greater than 0");
        require(recipient != address(0), "Invalid recipient");
        require(relayFee >= 0, "Invalid relay fee");
        require(nullifier != bytes32(0), "Invalid nullifier");
        require(newCommitment != bytes32(0), "Invalid new commitment");
        
        // Check if nullifier has been used
        if (nullifierUsed[nullifier]) {
            revert NullifierAlreadyUsed();
        }
        
        // Find the root index that matches the proof's Merkle root
        uint256 rootIndex = findMerkleRootIndex(merkleRoot);
        if (rootIndex == type(uint256).max) {
            revert MerkleRootNotFound();
        }
        
        // Verify the zk-SNARK proof with the circuit's expected public input format:
        // [nullifier, newCommitment, merkleRoot, withdrawAmount, recipient, relayFee]
        uint256[6] memory proofInputs = [
            uint256(nullifier),
            uint256(newCommitment),
            uint256(merkleRoot),
            amount,
            uint256(uint160(recipient)),
            relayFee
        ];
        
        if (!verifier.verifyProof(a, b, c, proofInputs)) {
            revert InvalidProof();
        }
        
        // Mark nullifier as used
        nullifierUsed[nullifier] = true;
        
        // Update Merkle branch with new commitment (change note)
        updateMerkleBranch(newCommitment);
        
        // Calculate new Merkle root
        bytes32 newRoot = calculateMerkleRoot();
        _updateMerkleRoot(newRoot);
        
        // Calculate total withdrawal amount
        uint256 totalAmount = amount + relayFee;
        
        // Check contract balance
        if (address(this).balance < totalAmount) {
            revert InsufficientBalance();
        }
        
        // Transfer funds
        if (amount > 0) {
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "Transfer to recipient failed");
        }
        
        if (relayFee > 0) {
            (bool success, ) = msg.sender.call{value: relayFee}("");
            require(success, "Transfer to relay failed");
        }
        
        emit Withdrawal(nullifier, newCommitment, amount, recipient, relayFee);
    }
    
    /**
     * @dev Update the current Merkle root (only owner for now, in production this would be automated)
     * @param newRoot The new Merkle root
     */
    function updateMerkleRoot(bytes32 newRoot) external onlyOwner {
        _updateMerkleRoot(newRoot);
    }
    
    /**
     * @dev Internal function to update Merkle root
     * @param newRoot The new Merkle root
     */
    function _updateMerkleRoot(bytes32 newRoot) internal {
        merkleRoots[currentRootIndex] = newRoot;
        
        // Move to next index in circular buffer
        currentRootIndex = (currentRootIndex + 1) % MERKLE_ROOT_HISTORY_SIZE;
    }
    
    /**
     * @dev Get a specific Merkle root by index
     * @param index The index of the root to get
     * @return The Merkle root at the specified index
     */
    function getMerkleRoot(uint256 index) external view returns (bytes32) {
        require(index < MERKLE_ROOT_HISTORY_SIZE, "Invalid root index");
        return merkleRoots[index];
    }
    
    /**
     * @dev Get the current Merkle root
     * @return The current Merkle root
     */
    function getCurrentMerkleRoot() external view returns (bytes32) {
        // Current root is at the previous index since we increment after storing
        uint256 currentIndex = (currentRootIndex + MERKLE_ROOT_HISTORY_SIZE - 1) % MERKLE_ROOT_HISTORY_SIZE;
        return merkleRoots[currentIndex];
    }
    
    /**
     * @dev Get the current root index
     * @return The current root index
     */
    function getCurrentRootIndex() external view returns (uint256) {
        return currentRootIndex;
    }
    
    /**
     * @dev Get the current leaf index
     * @return The current leaf index
     */
    function getCurrentLeafIndex() external view returns (uint256) {
        return currentLeafIndex;
    }
    
    /**
     * @dev Get the Merkle branch
     * @return The current Merkle branch
     */
    function getMerkleBranch() external view returns (bytes32[MERKLE_DEPTH] memory) {
        return merkleBranch;
    }
    
    /**
     * @dev Check if a Merkle root exists in the history
     * @param root The Merkle root to check
     * @return The index if found, or type(uint256).max if not found
     */
    function findMerkleRootIndex(bytes32 root) public view returns (uint256) {
        for (uint256 i = 0; i < MERKLE_ROOT_HISTORY_SIZE; i++) {
            if (merkleRoots[i] == root) {
                return i;
            }
        }
        return type(uint256).max;
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw function for owner
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Emergency withdrawal failed");
    }
    
    /**
     * @dev Check if a nullifier has been used
     * @param nullifier The nullifier to check
     * @return True if the nullifier has been used
     */
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifierUsed[nullifier];
    }
    
    /**
     * @dev Get the contract balance
     * @return The contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Allow the contract to receive ETH
    receive() external payable {}
} 