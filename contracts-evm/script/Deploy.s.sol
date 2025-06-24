// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/PrivateMixer.sol";
import "../src/Verifier.sol";

/**
 * @title Deploy
 * @dev Deployment script for the PrivateMixer contracts
 */
contract Deploy is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the verifier contract first
        // Note: In production, you would need to generate the actual verification key
        // from the circuit and pass it here
        Verifier.VerificationKey memory vk = Verifier.VerificationKey({
            alpha1: [uint256(0), uint256(0)],
            beta2: [[uint256(0), uint256(0)], [uint256(0), uint256(0)]],
            gamma2: [uint256(0), uint256(0)],
            delta2: [uint256(0), uint256(0)],
            ic: new uint256[][2](0)
        });
        
        Verifier verifier = new Verifier(vk);
        console.log("Verifier deployed at:", address(verifier));
        
        // Deploy the main PrivateMixer contract
        PrivateMixer mixer = new PrivateMixer(address(verifier));
        console.log("PrivateMixer deployed at:", address(mixer));
        
        vm.stopBroadcast();
        
        // Save deployment addresses
        string memory deploymentInfo = string(abi.encodePacked(
            "Deployment Info:\n",
            "Verifier: ", vm.toString(address(verifier)), "\n",
            "PrivateMixer: ", vm.toString(address(mixer)), "\n"
        ));
        
        vm.writeFile("deployment.txt", deploymentInfo);
        console.log("Deployment addresses saved to deployment.txt");
    }
} 