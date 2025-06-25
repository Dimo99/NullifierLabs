import * as fs from 'fs';
import * as path from 'path';

//@ts-ignore
import { poseidonContract } from 'circomlibjs';

const { createCode } = poseidonContract;

interface PoseidonVariant {
    inputs: number;
    name: string;
}

interface ByteCodes {
    [key: string]: string;
}

// Use __dirname to make paths relative to script location
const contractsDir = path.resolve(__dirname, '../src');

async function generatePoseidonByteCodes(): Promise<void> {
    console.log('🔧 Generating PoseidonByteCodes contract...');
    
    // Generate bytecodes for T2, T3, T4
    const variants: PoseidonVariant[] = [
        { inputs: 1, name: 'T2' },
        { inputs: 2, name: 'T3' },
        { inputs: 3, name: 'T4' }
    ];
    
    const bytecodes: ByteCodes = {};
    
    for (const variant of variants) {
        try {
            console.log(`Generating bytecode for ${variant.inputs + 1} inputs (${variant.name})...`);
            const bytecode = createCode(variant.inputs);
            bytecodes[variant.name] = bytecode;
        } catch (error) {
            console.error(`❌ Error generating ${variant.name}:`, error);
            throw error;
        }
    }
    
    // Generate the single contract with all bytecodes
    const solidityContract = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PoseidonByteCodes
 * @dev Generated Poseidon bytecodes for deployment
 * Generated using circomlibjs for maximum compatibility with Circom circuits
 */
library PoseidonByteCodes {
    
    /**
     * @dev Get PoseidonT2 bytecode (1 input)
     * @return The Poseidon T2 contract bytecode
     */
    function getPoseidonT2Bytecode() internal pure returns (bytes memory) {
        return hex"${bytecodes.T2.slice(2)}";
    }
    
    /**
     * @dev Get PoseidonT3 bytecode (2 inputs)  
     * @return The Poseidon T3 contract bytecode
     */
    function getPoseidonT3Bytecode() internal pure returns (bytes memory) {
        return hex"${bytecodes.T3.slice(2)}";
    }
    
    /**
     * @dev Get PoseidonT4 bytecode (3 inputs)
     * @return The Poseidon T4 contract bytecode  
     */
    function getPoseidonT4Bytecode() internal pure returns (bytes memory) {
        return hex"${bytecodes.T4.slice(2)}";
    }
}`;
    
    // Write to file
    const contractPath = path.join(contractsDir, 'PoseidonByteCodes.sol');
    fs.writeFileSync(contractPath, solidityContract);
    
    console.log('✅ Generated PoseidonByteCodes.sol');
    console.log('✅ All Poseidon bytecodes generated successfully!');
}

// Run the generator
if (require.main === module) {
    generatePoseidonByteCodes().catch(console.error);
}