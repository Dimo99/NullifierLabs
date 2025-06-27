// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./WithdrawVerifier.sol";
import "./MerkleTree.sol";

contract PrivateMixer is ReentrancyGuard, Pausable, Ownable, MerkleTree {
    
    Groth16Verifier public immutable verifier;
    
    mapping(uint256 => bool) public nullifierUsed;
    
    event Deposit(uint256 commitment, uint256 amount, address depositor);
    event Withdrawal(
        uint256 nullifier,
        uint256 newCommitment,
        uint256 amount,
        address recipient,
        uint256 relayFee
    );
    
    error InvalidVerifierAddress();
    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidAmount();
    error InvalidRelayFee();
    error InsufficientBalance();
    error InvalidMerkleRoot();
    error MerkleRootNotFound();
    error InvalidPubkey();
    
    
    constructor(address _verifier, address _poseidon) 
        Ownable(msg.sender) 
        MerkleTree(_poseidon) 
    {
        if (_verifier == address(0)) {
            revert InvalidVerifierAddress();
        }

        verifier = Groth16Verifier(_verifier);
    }
    
    
    /**
     * @dev Deposit funds into the mixer
     * @param pubkey The public key for the note
     */
    function deposit(uint256 pubkey) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) {
            revert InvalidAmount();
        }
        if (pubkey == 0) {
            revert InvalidPubkey();
        }
        
        // Compute commitment = Poseidon(amount, pubkey)
        uint256[2] memory inputs = [msg.value, pubkey];
        uint256 commitment = poseidon.poseidon(inputs);
        
        // Insert commitment into Merkle tree (automatically updates root)
        insertLeaf(commitment);
        
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
        uint256 nullifier,
        uint256 newCommitment, 
        uint256 merkleRoot,
        uint256 amount,
        address recipient,
        uint256 relayFee
    ) external whenNotPaused nonReentrant {
        // Validate inputs
        require(amount > 0, "Amount must be greater than 0");
        require(recipient != address(0), "Invalid recipient");
        require(relayFee >= 0, "Invalid relay fee");
        require(nullifier != 0, "Invalid nullifier");
        require(newCommitment != 0, "Invalid new commitment");
        
        // Check if nullifier has been used
        if (nullifierUsed[nullifier]) {
            revert NullifierAlreadyUsed();
        }
        
        // Check if the Merkle root is known (exists in recent history)
        if (!isKnownRoot(merkleRoot)) {
            revert MerkleRootNotFound();
        }
        
        // Verify the zk-SNARK proof with the circuit's expected public input format:
        // [nullifier, newCommitment, merkleRoot, withdrawAmount, recipient, relayFee]
        uint256[6] memory proofInputs = [
            nullifier,
            newCommitment,
            merkleRoot,
            amount,
            uint256(uint160(recipient)),
            relayFee
        ];
        
        if (!verifier.verifyProof(a, b, c, proofInputs)) {
            revert InvalidProof();
        }
        
        // Mark nullifier as used
        nullifierUsed[nullifier] = true;
        
        // Insert new commitment (change note) into Merkle tree
        insertLeaf(newCommitment);
        
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
    function isNullifierUsed(uint256 nullifier) external view returns (bool) {
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