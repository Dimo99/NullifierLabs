// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PrivateMixer.sol";
import "./DeployPoseidon.s.sol";
import "./DeployGroth16Verifier.s.sol";

contract DeployPrivateMixer is Script {
    function run() external {
        // Deploy Poseidon contracts first
        DeployPoseidon poseidonDeployer = new DeployPoseidon();
        address poseidonT3 = poseidonDeployer.deployIPoseidon2();
        
        // Deploy Groth16 Verifier
        DeployGroth16Verifier verifierDeployer = new DeployGroth16Verifier();
        address verifierAddr = verifierDeployer.deployIfNeeded();

        // Deploy PrivateMixer
        vm.startBroadcast();
        PrivateMixer mixer = new PrivateMixer(verifierAddr, poseidonT3);
        vm.stopBroadcast();

        console.log("PrivateMixer deployed at:", address(mixer));
    }
}
