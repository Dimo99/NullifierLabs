// Basic unit tests for proof generation functions
//@ts-ignore
import { buildPoseidon } from 'circomlibjs';
import { 
  generatePubkey, 
  generateCommitment, 
  generateNullifier,
  generateChangeCommitment,
  generateCryptographicComponents
} from './proofGeneration';
import { WithdrawalProofInputs } from './types';

describe('Proof Generation Functions', () => {
  let poseidon: any;

  beforeAll(async () => {
    poseidon = await buildPoseidon();
  });

  test('generatePubkey should produce consistent results', async () => {
    const secretKey = BigInt(123456789);
    const pubkey1 = await generatePubkey(secretKey);
    const pubkey2 = await generatePubkey(secretKey);
    
    expect(pubkey1).toBe(pubkey2);
    expect(typeof pubkey1).toBe('string');
  });

  test('generateCommitment should produce consistent results', async () => {
    const amount = BigInt(1000);
    const pubkey = await generatePubkey(BigInt(123456789));
    
    const commitment1 = await generateCommitment(amount, pubkey);
    const commitment2 = await generateCommitment(amount, pubkey);
    
    expect(commitment1).toBe(commitment2);
    expect(typeof commitment1).toBe('string');
  });

  test('generateNullifier should produce consistent results', async () => {
    const secretKey = BigInt(123456789);
    const pubkey = await generatePubkey(secretKey);
    const commitment = await generateCommitment(BigInt(1000), pubkey);
    
    const nullifier1 = await generateNullifier(secretKey, commitment);
    const nullifier2 = await generateNullifier(secretKey, commitment);
    
    expect(nullifier1).toBe(nullifier2);
    expect(typeof nullifier1).toBe('string');
  });

  test('generateChangeCommitment should produce valid change note', async () => {
    const changeAmount = BigInt(400);
    const changeSecretKey = BigInt(987654321);
    
    const result = await generateChangeCommitment(changeAmount, changeSecretKey);
    
    expect(result).toHaveProperty('pubkey');
    expect(result).toHaveProperty('commitment');
    expect(typeof result.pubkey).toBe('string');
    expect(typeof result.commitment).toBe('string');
  });

  test('generateCryptographicComponents should produce all required components', async () => {
    const inputs: WithdrawalProofInputs = {
      noteAmount: BigInt(1000),
      noteSecretKey: BigInt(123456789),
      commitments: [BigInt(0)], // Will be replaced with actual commitment
      commitmentIndex: 0,
      withdrawAmount: BigInt(500),
      recipient: BigInt("0x742d35Cc6634C0532925a3b8D4C9db4C"),
      changeSecretKey: BigInt(987654321),
      relayFee: BigInt(100)
    };

    const components = await generateCryptographicComponents(inputs);
    
    expect(components).toHaveProperty('pubkey');
    expect(components).toHaveProperty('commitment');
    expect(components).toHaveProperty('nullifier');
    expect(components).toHaveProperty('changeCommitment');
    expect(components).toHaveProperty('changePubkey');
    
    // Verify all components are strings
    Object.values(components).forEach(value => {
      expect(typeof value).toBe('string');
    });
  });

  test('cryptographic functions should match circomlibjs directly', async () => {
    const secretKey = BigInt(123456789);
    const amount = BigInt(1000);
    
    // Generate using our functions
    const ourPubkey = await generatePubkey(secretKey);
    const ourCommitment = await generateCommitment(amount, ourPubkey);
    const ourNullifier = await generateNullifier(secretKey, ourCommitment);
    
    // Generate using circomlibjs directly
    const directPubkey = poseidon.F.toString(poseidon([secretKey]));
    const directCommitment = poseidon.F.toString(poseidon([amount, directPubkey]));
    const directNullifier = poseidon.F.toString(poseidon([secretKey, directCommitment]));
    
    // Should match exactly
    expect(ourPubkey).toBe(directPubkey);
    expect(ourCommitment).toBe(directCommitment);
    expect(ourNullifier).toBe(directNullifier);
  });
});
