// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/PrivateMixer.sol";
import "../src/Verifier.sol";
import "../src/Note.sol";

/**
 * @title Example
 * @dev Example script showing how to interact with the PrivateMixer contracts
 */
contract Example is Script {
    
    PrivateMixer public mixer;
    Verifier public verifier;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy contracts (if not already deployed)
        if (address(mixer) == address(0)) {
            // Deploy verifier
            Verifier.VerificationKey memory vk = Verifier.VerificationKey({
                alpha1: [uint256(1), uint256(1)],
                beta2: [[uint256(1), uint256(1)], [uint256(1), uint256(1)]],
                gamma2: [uint256(1), uint256(1)],
                delta2: [uint256(1), uint256(1)],
                ic: new uint256[][2](0)
            });
            
            verifier = new Verifier(vk);
            mixer = new PrivateMixer(address(verifier));
            
            console.log("Contracts deployed:");
            console.log("Verifier:", address(verifier));
            console.log("PrivateMixer:", address(mixer));
        }
        
        // Example: Deposit funds
        uint256 depositAmount = 1 ether;
        uint256 noteAmount = depositAmount;
        uint256 noteRandomness = uint256(keccak256(abi.encodePacked(block.timestamp, "randomness")));
        uint256 noteSecretKey = uint256(keccak256(abi.encodePacked(block.timestamp, "secret")));
        
        // Create note
        Note.NoteData memory note = Note.createNote(noteAmount, noteRandomness, noteSecretKey);
        
        // Compute commitment
        bytes32 commitment = Note.computeCommitment(note);
        
        console.log("Depositing funds...");
        console.log("Amount:", depositAmount);
        console.log("Commitment:", commitment);
        
        // Deposit
        mixer.deposit{value: depositAmount}(commitment);
        
        console.log("Deposit successful!");
        console.log("Contract balance:", mixer.getBalance());
        console.log("Merkle root:", mixer.getMerkleRoot());
        
        // Example: Prepare withdrawal (this would normally be done off-chain with the circuit)
        uint256 withdrawAmount = 0.5 ether;
        uint256 relayFee = 0.01 ether;
        address recipient = address(0x123);
        
        // Compute nullifier
        bytes32 nullifier = Note.computeNullifier(note);
        
        // Create new note for change
        uint256 changeAmount = noteAmount - withdrawAmount - relayFee;
        uint256 newNoteRandomness = uint256(keccak256(abi.encodePacked(block.timestamp, "new_randomness")));
        uint256 newNoteSecretKey = uint256(keccak256(abi.encodePacked(block.timestamp, "new_secret")));
        
        Note.NoteData memory newNote = Note.createNote(changeAmount, newNoteRandomness, newNoteSecretKey);
        bytes32 newCommitment = Note.computeCommitment(newNote);
        
        console.log("\nPreparing withdrawal...");
        console.log("Withdraw amount:", withdrawAmount);
        console.log("Relay fee:", relayFee);
        console.log("Recipient:", recipient);
        console.log("Nullifier:", nullifier);
        console.log("New commitment:", newCommitment);
        
        // Mock proof parameters (in real implementation, these would come from the circuit)
        uint256[2] memory a = [uint256(1), uint256(1)];
        uint256[2][2] memory b = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];
        uint256[2] memory c = [uint256(1), uint256(1)];
        uint256[4] memory publicInputs = [
            mixer.getMerkleRoot(), // merkle_root
            withdrawAmount,        // withdraw_amount
            uint256(uint160(recipient)), // recipient
            relayFee               // relay_fee
        ];
        
        console.log("\nWithdrawing funds...");
        
        // Withdraw (this will fail with the mock proof, but shows the structure)
        try mixer.withdraw(
            a, b, c, publicInputs,
            nullifier,
            newCommitment,
            withdrawAmount,
            recipient,
            relayFee
        ) {
            console.log("Withdrawal successful!");
        } catch Error(string memory reason) {
            console.log("Withdrawal failed:", reason);
        }
        
        vm.stopBroadcast();
        
        console.log("\nExample completed!");
        console.log("Note: The withdrawal will fail with mock proof data.");
        console.log("In a real implementation, you would:");
        console.log("1. Generate the actual zk-SNARK proof using the circuit");
        console.log("2. Use the real verification key in the Verifier contract");
        console.log("3. Implement proper Poseidon hash functions");
    }
} 