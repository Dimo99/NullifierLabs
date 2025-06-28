import { generatePubkeyFromHex, generateCommitmentFromHex } from '@private-mixer/shared';

// Mouse entropy collector
export class MouseEntropyCollector {
  private entropy: number[] = [];
  private isCollecting = false;
  private startTime = 0;
  private onProgress?: (progress: number) => void;
  private onComplete?: (secretKey: string) => void;

  constructor(onProgress?: (progress: number) => void, onComplete?: (secretKey: string) => void) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
  }

  startCollection() {
    this.entropy = [];
    this.isCollecting = true;
    this.startTime = Date.now();
    
    // Add mouse move listener
    document.addEventListener('mousemove', this.handleMouseMove);
    
    // Add some initial entropy from timestamp and random
    this.addEntropy(Date.now() % 65536);
    this.addEntropy(Math.floor(Math.random() * 65536));
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isCollecting) return;
    
    // Collect entropy from mouse coordinates and timing
    const timestamp = Date.now();
    const timeDelta = timestamp - this.startTime;
    
    // Collect fewer bytes per event to slow down the process
    // Also add some randomness to which values we collect
    if (this.entropy.length % 3 === 0) {
      this.addEntropy(event.clientX % 256);
    }
    if (this.entropy.length % 3 === 1) {
      this.addEntropy(event.clientY % 256);
    }
    if (this.entropy.length % 5 === 0) {
      this.addEntropy(timeDelta % 256);
    }
    if (Math.abs(event.movementX) > 2) {
      this.addEntropy((event.movementX + 128) % 256);
    }
    if (Math.abs(event.movementY) > 2) {
      this.addEntropy((event.movementY + 128) % 256);
    }
    
    // Calculate progress (need 512 bytes of entropy + minimum 3 seconds)
    const timeProgress = Math.min((timestamp - this.startTime) / 3000, 1);
    const entropyProgress = Math.min(this.entropy.length / 512, 1);
    const progress = Math.min(timeProgress, entropyProgress);
    this.onProgress?.(progress);
    
    // Complete when we have enough entropy AND minimum time has passed
    if (this.entropy.length >= 512 && (timestamp - this.startTime) >= 3000) {
      this.completeCollection();
    }
  };

  private addEntropy(value: number) {
    this.entropy.push(value & 0xFF);
  }

  private completeCollection() {
    this.isCollecting = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
    
    // Generate secret key from entropy
    const secretKey = this.generateSecretKey();
    this.onComplete?.(secretKey);
  }

  private generateSecretKey(): string {
    // Ensure we have enough entropy
    while (this.entropy.length < 32) {
      this.entropy.push(Math.floor(Math.random() * 256));
    }
    
    // Create 32-byte secret key from entropy
    const secretBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      secretBytes[i] = this.entropy[i] ^ this.entropy[i + 32] ^ this.entropy[i + 64] ^ this.entropy[i + 96];
    }
    
    // Convert to BigInt and mask to 252 bits for BN254 field compatibility
    let secretBigInt = BigInt('0x' + Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    // Mask to 252 bits by clearing the top 4 bits
    const mask252 = (BigInt(1) << BigInt(252)) - BigInt(1);
    secretBigInt = secretBigInt & mask252;
    
    // Convert back to hex string (still 64 chars but top 4 bits are zero)
    return secretBigInt.toString(16).padStart(64, '0');
  }

  stopCollection() {
    this.isCollecting = false;
    document.removeEventListener('mousemove', this.handleMouseMove);
  }
}

// Generate public key from secret key
export async function generatePublicKey(secretKey: string): Promise<string> {
  return await generatePubkeyFromHex(secretKey);
}

// Encode secret key + amount into a single hex string
export function encodeSecret(secretKey: string, amount: bigint): string {
  // 32 bytes secret + 32 bytes amount = 64 bytes total
  const amountHex = amount.toString(16).padStart(64, '0');
  return secretKey + amountHex;
}

// Decode secret key and amount from hex string
export function decodeSecret(encodedSecret: string): { secretKey: string; amount: bigint } {
  if (encodedSecret.length !== 128) {
    throw new Error('Invalid encoded secret length');
  }
  
  const secretKey = encodedSecret.slice(0, 64);
  const amountHex = encodedSecret.slice(64, 128);
  const amount = BigInt('0x' + amountHex);
  
  return { secretKey, amount };
}

// Calculate commitment from amount and public key
export async function calculateCommitment(amount: bigint, publicKey: string): Promise<string> {
  return await generateCommitmentFromHex(amount, publicKey);
}