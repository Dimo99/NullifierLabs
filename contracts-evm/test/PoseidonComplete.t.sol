// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PoseidonTestBase.sol";

/**
 * @title PoseidonCompleteTest
 * @dev Unit tests comparing Poseidon implementation against circomlibjs using FFI
 */
contract PoseidonCompleteTest is PoseidonTestBase {
    
    function testPoseidonT2WithKnownValues() public {
        uint256[] memory inputs1 = new uint256[](1);
        inputs1[0] = 1;
        uint256 expected1 = _getCircomlibResult(1, inputs1);
        uint256[1] memory contractInput1 = [uint256(1)];
        uint256 actual1 = poseidonT2.poseidon(contractInput1);
        assertEq(actual1, expected1);

        uint256[] memory inputs2 = new uint256[](1);
        inputs2[0] = 0;
        uint256 expected2 = _getCircomlibResult(1, inputs2);
        uint256[1] memory contractInput2 = [uint256(0)];
        uint256 actual2 = poseidonT2.poseidon(contractInput2);
        assertEq(actual2, expected2);

        uint256[] memory inputs3 = new uint256[](1);
        inputs3[0] = 123456789;
        uint256 expected3 = _getCircomlibResult(1, inputs3);
        uint256[1] memory contractInput3 = [uint256(123456789)];
        uint256 actual3 = poseidonT2.poseidon(contractInput3);
        assertEq(actual3, expected3);
    }
    
    function testPoseidonT3WithKnownValues() public {
        uint256[] memory inputs1 = new uint256[](2);
        inputs1[0] = 1;
        inputs1[1] = 2;
        uint256 expected1 = _getCircomlibResult(2, inputs1);
        uint256[2] memory contractInput1 = [uint256(1), uint256(2)];
        uint256 actual1 = poseidonT3.poseidon(contractInput1);
        assertEq(actual1, expected1);

        uint256[] memory inputs2 = new uint256[](2);
        inputs2[0] = 0;
        inputs2[1] = 0;
        uint256 expected2 = _getCircomlibResult(2, inputs2);
        uint256[2] memory contractInput2 = [uint256(0), uint256(0)];
        uint256 actual2 = poseidonT3.poseidon(contractInput2);
        assertEq(actual2, expected2);
    }
    
    function testPoseidonT4WithKnownValues() public {
        uint256[] memory inputs = new uint256[](3);
        inputs[0] = 1;
        inputs[1] = 2;
        inputs[2] = 3;
        uint256 expected = _getCircomlibResult(3, inputs);
        uint256[3] memory contractInput = [uint256(1), uint256(2), uint256(3)];
        uint256 actual = poseidonT4.poseidon(contractInput);
        assertEq(actual, expected);
    }
    
    function testPoseidonT2Deterministic() public {
        uint256[] memory inputs = new uint256[](1);
        inputs[0] = 3116;
        uint256 circomlibResult = _getCircomlibResult(1, inputs);
        uint256[1] memory contractInput = [uint256(3116)];
        uint256 contractResult = poseidonT2.poseidon(contractInput);

        assertEq(circomlibResult, contractResult);
    }

}