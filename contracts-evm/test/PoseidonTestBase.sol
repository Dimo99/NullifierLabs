// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/IPoseidon.sol";
import "../script/DeployPoseidon.s.sol";

/**
 * @title PoseidonTestBase
 * @dev Base contract for Poseidon tests with shared functionality
 */
abstract contract PoseidonTestBase is Test {
    IPoseidon1 internal poseidonT2;
    IPoseidon2 internal poseidonT3;
    IPoseidon3 internal poseidonT4;

    function setUp() public virtual {
        // Deploy all Poseidon contracts
        DeployPoseidon deployer = new DeployPoseidon();
        (address poseidonT2Addr, address poseidonT3Addr, address poseidonT4Addr) = deployer.deployAll();

        poseidonT2 = IPoseidon1(poseidonT2Addr);
        poseidonT3 = IPoseidon2(poseidonT3Addr);
        poseidonT4 = IPoseidon3(poseidonT4Addr);
    }

    /**
     * @dev Call circomlibjs Poseidon via FFI for reference values
     */
    function _getCircomlibResult(uint256 nInputs, uint256[] memory inputs) internal returns (uint256) {
        string[] memory args = new string[](4 + nInputs);
        args[0] = "npx";
        args[1] = "ts-node";
        args[2] = "scripts/poseidon_test.ts";
        args[3] = vm.toString(nInputs);
        
        for (uint i = 0; i < nInputs; i++) {
            args[4 + i] = vm.toString(inputs[i]);
        }

        bytes memory result = vm.ffi(args);
        return uint256(bytes32(result));
    }

    /**
     * @dev Field modulus for BN254 curve used in Poseidon
     */
    function _getFieldModulus() internal pure returns (uint256) {
        return 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    }
}