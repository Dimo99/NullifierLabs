// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PrivateMixer.sol";
import "../src/WithdrawVerifier.sol";
import "../src/IPoseidon.sol";
import "../script/DeployPoseidon.s.sol";

contract PrivateMixerTest is Test {
    PrivateMixer public mixer;
    Groth16Verifier public verifier;
    IPoseidon1 public poseidonT2;
    IPoseidon2 public poseidonT3;
    IPoseidon3 public poseidonT4;

    address public user1 = address(0x1);
    address public user2 = address(0x2);

    function setUp() public {
        // Deploy all Poseidon contracts
        DeployPoseidon deployPoseidon = new DeployPoseidon();
        (
            address poseidonT2Addr,
            address poseidonT3Addr,
            address poseidonT4Addr
        ) = deployPoseidon.deployAll();
        poseidonT2 = IPoseidon1(poseidonT2Addr);
        poseidonT3 = IPoseidon2(poseidonT3Addr);
        poseidonT4 = IPoseidon3(poseidonT4Addr);

        // Deploy verifier
        verifier = new Groth16Verifier();

        // Deploy PrivateMixer (uses poseidonT3 for 2 inputs)
        mixer = new PrivateMixer(address(verifier), poseidonT3Addr);

        // Fund test accounts
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function generateCommitment(
        uint256 amount,
        uint256 secretKey
    ) internal view returns (uint256) {
        // First hash the secret key to get the public key using Poseidon1
        uint256[1] memory secretKeyInput = [secretKey];
        uint256 pubkey = poseidonT2.poseidon(secretKeyInput);

        // Then hash amount and pubkey to get the commitment using Poseidon2
        uint256[2] memory commitmentInputs = [amount, pubkey];
        return poseidonT3.poseidon(commitmentInputs);
    }

    function generatePubkey(uint256 secretKey) internal view returns (uint256) {
        uint256[1] memory secretKeyInput = [secretKey];
        return poseidonT2.poseidon(secretKeyInput);
    }

    function testBasicDeposit() public {
        // Generate a test note with proper structure
        uint256 amount = 1 ether;
        uint256 secretKey = 987654321;

        uint256 pubkey = generatePubkey(secretKey);
        uint256 expectedCommitment = generateCommitment(amount, secretKey);

        // Record initial state
        uint256 initialBalance = address(mixer).balance;
        uint256 initialLeafIndex = mixer.currentLeafIndex();

        // Perform deposit and capture event
        vm.startPrank(user1);
        vm.expectEmit(true, true, true, true, address(mixer));
        emit PrivateMixer.Deposit(expectedCommitment, amount, user1);
        mixer.deposit{value: amount}(pubkey);
        vm.stopPrank();

        // Verify deposit was successful
        assertEq(
            address(mixer).balance,
            initialBalance + amount,
            "Contract balance should increase by deposit amount"
        );
        assertEq(
            mixer.currentLeafIndex(),
            initialLeafIndex + 1,
            "Leaf index should increment by 1"
        );

        // Verify Merkle root changed
        uint256 newRoot = mixer.roots(mixer.currentRootIndex() - 1);
        assertTrue(newRoot != 0, "New Merkle root should not be zero");
    }

    function testMultipleDeposits() public {
        uint256 numDeposits = 5;
        uint256[] memory pubkeys = new uint256[](numDeposits);
        uint256[] memory amounts = new uint256[](numDeposits);
        uint256[] memory expectedCommitments = new uint256[](numDeposits);

        // Generate pubkeys and expected commitments with varying amounts
        for (uint256 i = 0; i < numDeposits; i++) {
            amounts[i] = (i + 1) * 0.5 ether;
            uint256 secretKey = uint256(keccak256(abi.encode("secret", i)));
            pubkeys[i] = generatePubkey(secretKey);
            expectedCommitments[i] = generateCommitment(amounts[i], secretKey);
        }

        uint256 initialBalance = address(mixer).balance;
        uint256 initialLeafIndex = mixer.currentLeafIndex();
        uint256 totalDeposited = 0;

        // Perform multiple deposits
        for (uint256 i = 0; i < numDeposits; i++) {
            vm.startPrank(user1);
            vm.expectEmit(true, true, true, true, address(mixer));
            emit PrivateMixer.Deposit(expectedCommitments[i], amounts[i], user1);
            mixer.deposit{value: amounts[i]}(pubkeys[i]);
            vm.stopPrank();
            totalDeposited += amounts[i];
        }

        // Verify all deposits
        assertEq(
            address(mixer).balance,
            initialBalance + totalDeposited,
            "Balance should increase by total deposits"
        );
        assertEq(
            mixer.currentLeafIndex(),
            initialLeafIndex + numDeposits,
            "Leaf index should increase by number of deposits"
        );
    }

    function testDepositWithZeroValue() public {
        uint256 secretKey = 789012;
        uint256 pubkey = generatePubkey(secretKey);

        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSelector(PrivateMixer.InvalidAmount.selector));
        mixer.deposit{value: 0}(pubkey);
        vm.stopPrank();
    }

    function testDepositWithZeroPubkey() public {
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSelector(PrivateMixer.InvalidPubkey.selector));
        mixer.deposit{value: 1 ether}(0);
        vm.stopPrank();
    }

    function testDepositWhenPaused() public {
        uint256 amount = 1 ether;
        uint256 pubkey = generatePubkey(789012);

        // Pause the contract
        mixer.pause();

        // Try to deposit
        vm.startPrank(user1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        mixer.deposit{value: amount}(pubkey);
        vm.stopPrank();

        // Unpause and verify deposit works
        mixer.unpause();

        vm.startPrank(user1);
        mixer.deposit{value: amount}(pubkey);
        vm.stopPrank();

        assertEq(
            address(mixer).balance,
            amount,
            "Deposit should work after unpause"
        );
    }

    function testMerkleRootHistory() public {
        uint256 historySize = mixer.ROOTS_CAPACITY();
        uint256[] memory roots = new uint256[](historySize + 2);

        // Make more deposits than history size
        for (uint256 i = 0; i < historySize + 2; i++) {
            uint256 amount = 0.1 ether;
            uint256 secretKey = uint256(keccak256(abi.encode("key", i)));
            uint256 pubkey = generatePubkey(secretKey);

            vm.startPrank(user1);
            mixer.deposit{value: amount}(pubkey);
            vm.stopPrank();

            roots[i] = mixer.roots(
                mixer.currentRootIndex() == 0
                    ? mixer.ROOTS_CAPACITY() - 1
                    : mixer.currentRootIndex() - 1
            );
        }

        // Verify that only the last MERKLE_ROOT_HISTORY_SIZE roots are stored
        // The oldest roots should have been overwritten
        bool firstRootExists = mixer.isKnownRoot(roots[0]);
        bool secondRootExists = mixer.isKnownRoot(roots[1]);
        assertFalse(
            firstRootExists,
            "First root should be overwritten"
        );
        assertFalse(
            secondRootExists,
            "Second root should be overwritten"
        );

        // Recent roots should still exist
        bool lastRootExists = mixer.isKnownRoot(
            roots[historySize + 1]
        );
        assertTrue(
            lastRootExists,
            "Recent root should exist"
        );
    }

    function testDepositAndWithdrawal() public {
        // Step 1: Make a deposit
        uint256 depositAmount = 1 ether;
        uint256 secretKey = 987654321;

        uint256 pubkey = generatePubkey(secretKey);
        uint256 commitment = generateCommitment(depositAmount, secretKey);

        vm.startPrank(user1);
        vm.expectEmit(true, true, true, true, address(mixer));
        emit PrivateMixer.Deposit(commitment, depositAmount, user1);
        mixer.deposit{value: depositAmount}(pubkey);
        vm.stopPrank();

        uint256 merkleRoot = mixer.roots(mixer.currentRootIndex() - 1);

        // Step 2: Generate withdrawal proof using FFI
        uint256 withdrawAmount = 0.8 ether;
        uint256 relayFee = 0.01 ether;
        uint256 recipient = uint256(uint160(user2));

        // Call the proof generation script via FFI
        string[] memory args = new string[](10);
        args[0] = "node";
        args[1] = "../dist/contracts-evm/scripts/generate_withdrawal_proof.js";
        args[2] = vm.toString(depositAmount); // noteAmount
        args[3] = vm.toString(secretKey); // noteSecretKey
        args[4] = "0"; // commitmentIndex (first deposit)
        args[5] = vm.toString(withdrawAmount); // withdrawAmount
        args[6] = vm.toString(recipient); // recipient
        args[7] = vm.toString(relayFee); // relayFee
        args[8] = vm.toString(commitment); // commitment list (just one for now)

        bytes memory result = vm.ffi(args);

        // ABI decode the result
        (
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c,
            uint256 nullifier,
            uint256 newCommitment,
            uint256 proofMerkleRoot,
            uint256 proofWithdrawAmount,
            address proofRecipient,
            uint256 proofRelayFee
        ) = abi.decode(
            result,
            (
                uint256[2],
                uint256[2][2],
                uint256[2],
                uint256,
                uint256,
                uint256,
                uint256,
                address,
                uint256
            )
        );

        // Verify proof values match our expectations
        assertEq(proofWithdrawAmount, withdrawAmount, "Withdraw amount mismatch");
        assertEq(proofRecipient, user2, "Recipient mismatch");
        assertEq(proofRelayFee, relayFee, "Relay fee mismatch");
        assertEq(proofMerkleRoot, merkleRoot, "Merkle root mismatch");

        // Record initial state before withdrawal
        uint256 initialContractBalance = address(mixer).balance;
        uint256 initialRecipientBalance = address(user2).balance;
        uint256 initialRelayBalance = address(this).balance;

        address relayAddress = makeAddr("relay");
        // Execute the withdrawal!
        vm.startPrank(relayAddress);
        mixer.withdraw(
            a,
            b, 
            c,
            nullifier,
            newCommitment,
            proofMerkleRoot,
            proofWithdrawAmount,
            proofRecipient,
            proofRelayFee
        );
        vm.stopPrank();

        assertEq(
            relayAddress.balance,
            relayFee,
            "Relay should receive the relay fee"
        );

        // Verify withdrawal was successful
        assertEq(
            address(mixer).balance,
            initialContractBalance - withdrawAmount - relayFee,
            "Contract balance should decrease by withdrawal + relay fee"
        );
        assertEq(
            address(user2).balance,
            initialRecipientBalance + withdrawAmount,
            "Recipient should receive withdraw amount"
        );
        assertEq(
            mixer.currentLeafIndex(),
            2,
            "Should have two commitments (original + change note)"
        );

        // Verify nullifier is marked as used
        assertTrue(mixer.nullifierUsed(nullifier), "Nullifier should be marked as used");
    }
}
