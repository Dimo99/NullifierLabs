// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/PoseidonByteCodes.sol";

/**
 * @title DeployPoseidon
 * @dev Simple deployment script that calculates deterministic addresses and deploys if needed
 */
contract DeployPoseidon is Script {
    bytes32 constant SALT = keccak256("POSEIDON_V1");

    function run()
        external
        returns (
            address poseidonT2Addr,
            address poseidonT3Addr,
            address poseidonT4Addr
        )
    {
        vm.startBroadcast();
        (poseidonT2Addr, poseidonT3Addr, poseidonT4Addr) = deployAll();
        vm.stopBroadcast();
    }

    function deployAll()
        public
        returns (
            address poseidonT2Addr,
            address poseidonT3Addr,
            address poseidonT4Addr
        )
    {
        poseidonT2Addr = deployIfNeeded(
            PoseidonByteCodes.getPoseidonT2Bytecode(),
            "T2"
        );

        poseidonT3Addr = deployIfNeeded(
            PoseidonByteCodes.getPoseidonT3Bytecode(),
            "T3"
        );

        poseidonT4Addr = deployIfNeeded(
            PoseidonByteCodes.getPoseidonT4Bytecode(),
            "T4"
        );
    }

    function deployIfNeeded(
        bytes memory bytecode,
        string memory name
    ) internal returns (address addr) {
        // Calculate deterministic address
        addr = vm.computeCreate2Address(
            SALT,
            keccak256(bytecode),
            address(this)
        );

        // Check if already deployed
        if (addr.code.length > 0) {
            console.log(
                string.concat("Poseidon", name, " already deployed at:"),
                addr
            );
            return addr;
        }

        // Deploy with CREATE2
        bytes32 salt = SALT;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        // Verify the address matches expected
        require(
            addr ==
                vm.computeCreate2Address(
                    SALT,
                    keccak256(bytecode),
                    address(this)
                ),
            "Address mismatch"
        );
    }
}
