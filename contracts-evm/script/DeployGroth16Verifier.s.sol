// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/WithdrawVerifier.sol";

contract DeployGroth16Verifier is Script {
    bytes32 constant SALT = keccak256("GROTH16_VERIFIER_V1");

    function run() external returns (address verifierAddr) {
        verifierAddr = deployIfNeeded();
    }

    function deployIfNeeded() public returns (address addr) {
        // Get verifier bytecode
        bytes memory bytecode = type(Groth16Verifier).creationCode;
        
        // Calculate deterministic address
        addr = vm.computeCreate2Address(SALT, keccak256(bytecode));

        // Check if already deployed
        if (addr.code.length > 0) {
            console.log("Groth16Verifier already deployed at:", addr);
            return addr;
        }

        // Deploy with CREATE2
        vm.startBroadcast();
        bytes32 salt = SALT;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        vm.stopBroadcast();

        console.log("Groth16Verifier deployed at:", addr);
        
        // Verify the address matches expected
        require(
            addr == vm.computeCreate2Address(SALT, keccak256(bytecode)),
            "Verifier address mismatch"
        );
    }
}