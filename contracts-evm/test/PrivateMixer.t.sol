// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/PrivateMixer.sol";
import "../src/Verifier.sol";
import "../src/Note.sol";
import "../src/MerkleTree.sol";

/**
 * @title PrivateMixerTest
 * @dev Test contract for PrivateMixer functionality
 */
contract PrivateMixerTest is Test {
    
    PrivateMixer public mixer;
    Verifier public verifier;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);
    
    uint256 public constant DEPOSIT_AMOUNT = 1 ether;
    uint256 public constant WITHDRAW_AMOUNT = 0.5 ether;
    uint256 public constant RELAY_FEE = 0.01 ether;
    
    function setUp() public {
        // Deploy verifier with placeholder verification key
        Verifier.VerificationKey memory vk = Verifier.VerificationKey({
            alpha1: [uint256(1), uint256(1)],
            beta2: [[uint256(1), uint256(1)], [uint256(1), uint256(1)]],
            gamma2: [uint256(1), uint256(1)],
            delta2: [uint256(1), uint256(1)],
            ic: new uint256[][2](0)
        });
        
        verifier = new Verifier(vk);
        mixer = new PrivateMixer(address(verifier));
        
        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }
    
    function testDeposit() public {
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        
        vm.prank(alice);
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        assertEq(mixer.getBalance(), DEPOSIT_AMOUNT);
        assertEq(mixer.getMerkleRoot(), keccak256(abi.encodePacked(bytes32(0), commitment)));
    }
    
    function testDepositWithZeroAmount() public {
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        
        vm.prank(alice);
        vm.expectRevert("Amount must be greater than 0");
        mixer.deposit{value: 0}(commitment);
    }
    
    function testDepositWithZeroCommitment() public {
        vm.prank(alice);
        vm.expectRevert("Invalid commitment");
        mixer.deposit{value: DEPOSIT_AMOUNT}(bytes32(0));
    }
    
    function testWithdraw() public {
        // First, make a deposit
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        vm.prank(alice);
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        // Create withdrawal parameters
        bytes32 nullifier = keccak256(abi.encodePacked("test_nullifier"));
        bytes32 newCommitment = keccak256(abi.encodePacked("new_commitment"));
        
        // Mock proof parameters (in real implementation, these would come from the circuit)
        uint256[2] memory a = [uint256(1), uint256(1)];
        uint256[2][2] memory b = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];
        uint256[2] memory c = [uint256(1), uint256(1)];
        uint256[4] memory publicInputs = [
            mixer.getMerkleRoot(), // merkle_root
            WITHDRAW_AMOUNT,       // withdraw_amount
            uint256(uint160(bob)), // recipient
            RELAY_FEE              // relay_fee
        ];
        
        uint256 bobBalanceBefore = bob.balance;
        
        vm.prank(charlie); // Charlie acts as the relay
        mixer.withdraw(
            a, b, c, publicInputs,
            nullifier,
            newCommitment,
            WITHDRAW_AMOUNT,
            bob,
            RELAY_FEE
        );
        
        // Check balances
        assertEq(bob.balance, bobBalanceBefore + WITHDRAW_AMOUNT);
        assertEq(charlie.balance, 10 ether + RELAY_FEE);
        
        // Check nullifier is marked as used
        assertTrue(mixer.isNullifierUsed(nullifier));
        
        // Check new merkle root
        assertEq(mixer.getMerkleRoot(), keccak256(abi.encodePacked(
            keccak256(abi.encodePacked(bytes32(0), commitment)),
            newCommitment
        )));
    }
    
    function testWithdrawWithUsedNullifier() public {
        // First, make a deposit
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        vm.prank(alice);
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        // Create withdrawal parameters
        bytes32 nullifier = keccak256(abi.encodePacked("test_nullifier"));
        bytes32 newCommitment = keccak256(abi.encodePacked("new_commitment"));
        
        // Mock proof parameters
        uint256[2] memory a = [uint256(1), uint256(1)];
        uint256[2][2] memory b = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];
        uint256[2] memory c = [uint256(1), uint256(1)];
        uint256[4] memory publicInputs = [
            mixer.getMerkleRoot(),
            WITHDRAW_AMOUNT,
            uint256(uint160(bob)),
            RELAY_FEE
        ];
        
        // First withdrawal
        vm.prank(charlie);
        mixer.withdraw(a, b, c, publicInputs, nullifier, newCommitment, WITHDRAW_AMOUNT, bob, RELAY_FEE);
        
        // Try to use the same nullifier again
        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSelector(PrivateMixer.NullifierAlreadyUsed.selector));
        mixer.withdraw(a, b, c, publicInputs, nullifier, newCommitment, WITHDRAW_AMOUNT, bob, RELAY_FEE);
    }
    
    function testWithdrawWithInvalidAmount() public {
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        vm.prank(alice);
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        bytes32 nullifier = keccak256(abi.encodePacked("test_nullifier"));
        bytes32 newCommitment = keccak256(abi.encodePacked("new_commitment"));
        
        uint256[2] memory a = [uint256(1), uint256(1)];
        uint256[2][2] memory b = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];
        uint256[2] memory c = [uint256(1), uint256(1)];
        uint256[4] memory publicInputs = [
            mixer.getMerkleRoot(),
            0, // Invalid amount
            uint256(uint160(bob)),
            RELAY_FEE
        ];
        
        vm.prank(charlie);
        vm.expectRevert("Amount must be greater than 0");
        mixer.withdraw(a, b, c, publicInputs, nullifier, newCommitment, 0, bob, RELAY_FEE);
    }
    
    function testWithdrawWithInvalidRecipient() public {
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        vm.prank(alice);
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        bytes32 nullifier = keccak256(abi.encodePacked("test_nullifier"));
        bytes32 newCommitment = keccak256(abi.encodePacked("new_commitment"));
        
        uint256[2] memory a = [uint256(1), uint256(1)];
        uint256[2][2] memory b = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];
        uint256[2] memory c = [uint256(1), uint256(1)];
        uint256[4] memory publicInputs = [
            mixer.getMerkleRoot(),
            WITHDRAW_AMOUNT,
            uint256(0), // Invalid recipient
            RELAY_FEE
        ];
        
        vm.prank(charlie);
        vm.expectRevert("Invalid recipient");
        mixer.withdraw(a, b, c, publicInputs, nullifier, newCommitment, WITHDRAW_AMOUNT, address(0), RELAY_FEE);
    }
    
    function testPauseAndUnpause() public {
        assertFalse(mixer.paused());
        
        vm.prank(address(mixer.owner()));
        mixer.pause();
        assertTrue(mixer.paused());
        
        vm.prank(address(mixer.owner()));
        mixer.unpause();
        assertFalse(mixer.paused());
    }
    
    function testDepositWhenPaused() public {
        vm.prank(address(mixer.owner()));
        mixer.pause();
        
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        vm.prank(alice);
        vm.expectRevert("Pausable: paused");
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
    }
    
    function testWithdrawWhenPaused() public {
        vm.prank(address(mixer.owner()));
        mixer.pause();
        
        bytes32 nullifier = keccak256(abi.encodePacked("test_nullifier"));
        bytes32 newCommitment = keccak256(abi.encodePacked("new_commitment"));
        
        uint256[2] memory a = [uint256(1), uint256(1)];
        uint256[2][2] memory b = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];
        uint256[2] memory c = [uint256(1), uint256(1)];
        uint256[4] memory publicInputs = [
            mixer.getMerkleRoot(),
            WITHDRAW_AMOUNT,
            uint256(uint160(bob)),
            RELAY_FEE
        ];
        
        vm.prank(charlie);
        vm.expectRevert("Pausable: paused");
        mixer.withdraw(a, b, c, publicInputs, nullifier, newCommitment, WITHDRAW_AMOUNT, bob, RELAY_FEE);
    }
    
    function testEmergencyWithdraw() public {
        // Make a deposit
        bytes32 commitment = keccak256(abi.encodePacked("test_commitment"));
        vm.prank(alice);
        mixer.deposit{value: DEPOSIT_AMOUNT}(commitment);
        
        uint256 ownerBalanceBefore = address(mixer.owner()).balance;
        
        vm.prank(address(mixer.owner()));
        mixer.emergencyWithdraw(DEPOSIT_AMOUNT);
        
        assertEq(address(mixer.owner()).balance, ownerBalanceBefore + DEPOSIT_AMOUNT);
        assertEq(mixer.getBalance(), 0);
    }
    
    function testEmergencyWithdrawInsufficientBalance() public {
        vm.prank(address(mixer.owner()));
        vm.expectRevert("Insufficient balance");
        mixer.emergencyWithdraw(1 ether);
    }
    
    function testUpdateMerkleRoot() public {
        bytes32 newRoot = keccak256(abi.encodePacked("new_root"));
        
        vm.prank(address(mixer.owner()));
        mixer.updateMerkleRoot(newRoot);
        
        assertEq(mixer.getMerkleRoot(), newRoot);
    }
    
    function testUpdateMerkleRootNotOwner() public {
        bytes32 newRoot = keccak256(abi.encodePacked("new_root"));
        
        vm.prank(alice);
        vm.expectRevert("Ownable: caller is not the owner");
        mixer.updateMerkleRoot(newRoot);
    }
    
    function testNoteOperations() public {
        // Test note creation and validation
        Note.NoteData memory note = Note.createNote(1 ether, 123, 456);
        assertTrue(Note.isValid(note));
        
        // Test commitment computation
        bytes32 commitment = Note.computeCommitment(note);
        assertTrue(commitment != bytes32(0));
        
        // Test nullifier computation
        bytes32 nullifier = Note.computeNullifier(note);
        assertTrue(nullifier != bytes32(0));
        
        // Test serialization and deserialization
        bytes memory serialized = Note.serialize(note);
        Note.NoteData memory deserialized = Note.deserialize(serialized);
        assertEq(deserialized.amount, note.amount);
        assertEq(deserialized.randomness, note.randomness);
        assertEq(deserialized.secretKey, note.secretKey);
    }
    
    function testMerkleTreeOperations() public {
        // Test Merkle tree operations
        bytes32[] memory leaves = new bytes32[](4);
        leaves[0] = keccak256(abi.encodePacked("leaf1"));
        leaves[1] = keccak256(abi.encodePacked("leaf2"));
        leaves[2] = keccak256(abi.encodePacked("leaf3"));
        leaves[3] = keccak256(abi.encodePacked("leaf4"));
        
        bytes32 root = MerkleTree.computeRoot(leaves);
        assertTrue(root != bytes32(0));
        
        // Test proof generation and verification
        (bytes32[] memory path, uint256[] memory pathIndices) = MerkleTree.generateProof(leaves, 0);
        assertTrue(MerkleTree.verifyProof(leaves[0], path, pathIndices, root));
    }
} 