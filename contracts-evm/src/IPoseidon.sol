// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPoseidon - Interface for Poseidon hash functions
 * @dev Interface for all Poseidon hash variants
 */
interface IPoseidon1 {
    function poseidon(uint256[1] memory input) external pure returns (uint256);
}

interface IPoseidon2 {
    function poseidon(uint256[2] memory input) external pure returns (uint256);
}

interface IPoseidon3 {
    function poseidon(uint256[3] memory input) external pure returns (uint256);
}