import { ethers } from 'ethers';
import contractABI from '../../../contracts-evm/out/PrivateMixer.sol/PrivateMixer.json';

// Contract ABI from the compiled contract
export const PRIVATE_MIXER_ABI = contractABI.abi;

// Contract addresses by chain ID
export const CONTRACT_ADDRESSES = {
  // Local development (Anvil)
  31337: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  // Add other networks as needed
} as const;

export function getContractAddress(chainId: number): string {
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!address) {
    throw new Error(`Contract not deployed on chain ${chainId}`);
  }
  return address;
}

export function getPrivateMixerContract(
  provider: ethers.BrowserProvider,
  chainId: number
) {
  const address = getContractAddress(chainId);
  return new ethers.Contract(address, PRIVATE_MIXER_ABI, provider);
}