//@ts-ignore
import { buildPoseidon } from 'circomlibjs';

async function main(): Promise<void> {
    try {
        const args = process.argv.slice(2);
        
        if (args.length < 2) {
            process.stderr.write('Usage: poseidon_test.ts <nInputs> <input1> [input2] [input3]\n');
            process.exit(1);
        }
        
        const nInputs = parseInt(args[0]);
        const inputs = args.slice(1).map(arg => BigInt(arg));
        
        if (inputs.length !== nInputs) {
            process.stderr.write(`Expected ${nInputs} inputs but got ${inputs.length}\n`);
            process.exit(1);
        }
        
        // Build the appropriate Poseidon instance
        const poseidon = await buildPoseidon();
        
        // Calculate hash
        const hash = poseidon(inputs);
        const hashStr = poseidon.F.toString(hash);

        function encodeUint256(value: string | bigint): string {
            const hex = BigInt(value).toString(16);
            return '0x' + hex.padStart(64, '0'); // pad to 32 bytes (64 hex chars)
        }
        
        // Output only the hash value for easy parsing
        process.stdout.write(encodeUint256(hashStr));

    } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});