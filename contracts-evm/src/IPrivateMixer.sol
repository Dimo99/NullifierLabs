// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPrivateMixer
 * @dev Interface for the PrivateMixer contract
 */
interface IPrivateMixer {
    
    // Events
    event Deposit(bytes32 indexed commitment, uint256 amount, address indexed depositor);
    event Withdrawal(
        bytes32 indexed nullifier,
        bytes32 indexed newCommitment,
        uint256 amount,
        address indexed recipient,
        uint256 relayFee
    );
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    
    // Errors
    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidAmount();
    error InvalidRelayFee();
    error InsufficientBalance();
    error InvalidMerkleRoot();
    
    /**
     * @dev Deposit funds into the mixer
     * @param commitment The commitment hash of the note
     */
    function deposit(bytes32 commitment) external payable;
    
    /**
     * @dev Withdraw funds from the mixer using a zk-SNARK proof
     * @param a The 'a' component of the proof
     * @param b The 'b' component of the proof
     * @param c The 'c' component of the proof
     * @param publicInputs The public inputs for the proof verification
     * @param nullifier The nullifier to prevent double-spending
     * @param newCommitment The commitment for the change note
     * @param amount The amount to withdraw
     * @param recipient The recipient address
     * @param relayFee The fee for the relay service
     */
    function withdraw(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[4] memory publicInputs,
        bytes32 nullifier,
        bytes32 newCommitment,
        uint256 amount,
        address recipient,
        uint256 relayFee
    ) external;
    
    /**
     * @dev Update the merkle root
     * @param newRoot The new merkle root
     */
    function updateMerkleRoot(bytes32 newRoot) external;
    
    /**
     * @dev Pause the contract
     */
    function pause() external;
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external;
    
    /**
     * @dev Emergency withdraw function for owner
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external;
    
    /**
     * @dev Get the current merkle root
     * @return The current merkle root
     */
    function getMerkleRoot() external view returns (bytes32);
    
    /**
     * @dev Check if a nullifier has been used
     * @param nullifier The nullifier to check
     * @return True if the nullifier has been used
     */
    function isNullifierUsed(bytes32 nullifier) external view returns (bool);
    
    /**
     * @dev Get the contract balance
     * @return The contract balance
     */
    function getBalance() external view returns (uint256);
    
    /**
     * @dev Get the verifier contract address
     * @return The verifier contract address
     */
    function verifier() external view returns (address);
    
    /**
     * @dev Get the merkle tree depth
     * @return The merkle tree depth
     */
    function MERKLE_DEPTH() external view returns (uint256);
    
    /**
     * @dev Check if the contract is paused
     * @return True if the contract is paused
     */
    function paused() external view returns (bool);
    
    /**
     * @dev Get the contract owner
     * @return The contract owner address
     */
    function owner() external view returns (address);
} 