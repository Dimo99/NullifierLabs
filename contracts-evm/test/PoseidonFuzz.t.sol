// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PoseidonTestBase.sol";

/**
 * @title PoseidonFuzzTest
 * @dev Fuzz test suite for Poseidon implementation with random inputs
 */
contract PoseidonFuzzTest is PoseidonTestBase {
    
    function testFuzzPoseidonT2(uint256 input1) public {
        uint256 fieldModulus = _getFieldModulus();
        input1 = bound(input1, 0, fieldModulus - 1);
        
        uint256[] memory inputs = new uint256[](1);
        inputs[0] = input1;
        uint256 expected = _getCircomlibResult(1, inputs);
        
        uint256[1] memory contractInput = [input1];
        uint256 actual = poseidonT2.poseidon(contractInput);
        assertEq(actual, expected);
    }

    function testFuzzPoseidonT3(uint256 input1, uint256 input2) public {
        uint256 fieldModulus = _getFieldModulus();
        input1 = bound(input1, 0, fieldModulus - 1);
        input2 = bound(input2, 0, fieldModulus - 1);
        
        uint256[] memory inputs = new uint256[](2);
        inputs[0] = input1;
        inputs[1] = input2;
        uint256 expected = _getCircomlibResult(2, inputs);
        
        uint256[2] memory contractInput = [input1, input2];
        uint256 actual = poseidonT3.poseidon(contractInput);
        assertEq(actual, expected);
    }

    function testFuzzPoseidonT4(uint256 input1, uint256 input2, uint256 input3) public {
        uint256 fieldModulus = _getFieldModulus();
        input1 = bound(input1, 0, fieldModulus - 1);
        input2 = bound(input2, 0, fieldModulus - 1);
        input3 = bound(input3, 0, fieldModulus - 1);
        
        uint256[] memory inputs = new uint256[](3);
        inputs[0] = input1;
        inputs[1] = input2;
        inputs[2] = input3;
        uint256 expected = _getCircomlibResult(3, inputs);
        
        uint256[3] memory contractInput = [input1, input2, input3];
        uint256 actual = poseidonT4.poseidon(contractInput);
        assertEq(actual, expected);
    }
}