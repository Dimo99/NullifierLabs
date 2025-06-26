// Network configuration and utilities

export interface NetworkConfig {
  chainId: number;
  name: string;
  blockExplorer: string;
  currency: string;
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    blockExplorer: 'https://etherscan.io',
    currency: 'ETH'
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    blockExplorer: 'https://sepolia.etherscan.io',
    currency: 'ETH'
  },
  137: {
    chainId: 137,
    name: 'Polygon Mainnet',
    blockExplorer: 'https://polygonscan.com',
    currency: 'MATIC'
  },
  80001: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    blockExplorer: 'https://mumbai.polygonscan.com',
    currency: 'MATIC'
  },
  56: {
    chainId: 56,
    name: 'BSC Mainnet',
    blockExplorer: 'https://bscscan.com',
    currency: 'BNB'
  },
  97: {
    chainId: 97,
    name: 'BSC Testnet',
    blockExplorer: 'https://testnet.bscscan.com',
    currency: 'BNB'
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    blockExplorer: 'https://arbiscan.io',
    currency: 'ETH'
  },
  421613: {
    chainId: 421613,
    name: 'Arbitrum Testnet',
    blockExplorer: 'https://testnet.arbiscan.io',
    currency: 'ETH'
  },
  10: {
    chainId: 10,
    name: 'Optimism',
    blockExplorer: 'https://optimistic.etherscan.io',
    currency: 'ETH'
  },
  420: {
    chainId: 420,
    name: 'Optimism Testnet',
    blockExplorer: 'https://goerli-optimism.etherscan.io',
    currency: 'ETH'
  },
  31337: {
    chainId: 31337,
    name: 'Local Development',
    blockExplorer: '',
    currency: 'ETH'
  }
};

// Get network configuration by chain ID
export function getNetworkConfig(chainId: number): NetworkConfig {
  return SUPPORTED_NETWORKS[chainId] || SUPPORTED_NETWORKS[1]; // Default to Ethereum mainnet
}

// Get block explorer URL for a transaction
export function getTransactionUrl(chainId: number, txHash: string): string {
  const network = getNetworkConfig(chainId);
  
  // For local development, return a placeholder
  if (chainId === 31337 || !network.blockExplorer) {
    return '#';
  }
  
  return `${network.blockExplorer}/tx/${txHash}`;
}

// Get block explorer URL for an address
export function getAddressUrl(chainId: number, address: string): string {
  const network = getNetworkConfig(chainId);
  
  // For local development, return a placeholder
  if (chainId === 31337 || !network.blockExplorer) {
    return '#';
  }
  
  return `${network.blockExplorer}/address/${address}`;
}

// Check if network is supported
export function isNetworkSupported(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS;
}

// Get network name
export function getNetworkName(chainId: number): string {
  return getNetworkConfig(chainId).name;
}

// Get native currency symbol
export function getNativeCurrency(chainId: number): string {
  return getNetworkConfig(chainId).currency;
}