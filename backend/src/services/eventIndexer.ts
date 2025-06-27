import { ethers } from "ethers";
import { logger } from "../utils/logger";
import { DepositEvent, Config } from "../types";
//@ts-ignore
import PrivateMixerABI from "../../../contracts-evm/out/PrivateMixer.sol/PrivateMixer.json";
import { MerkleTreeService } from "./merkleTree";

export class EventIndexer {
  private static instance: EventIndexer;
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private config: Config;
  private isInitialized = false;
  private lastProcessedBlock: number = 0;
  private processedEvents: Set<string> = new Set(); // Track processed events by txHash + logIndex
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      rpcUrl: process.env.RPC_URL || "http://localhost:8545",
      contractAddress: process.env.CONTRACT_ADDRESS || "",
      startBlock: parseInt(process.env.START_BLOCK || "0"),
      confirmations: parseInt(process.env.CONFIRMATIONS || "6"),
      merkleDepth: 30,
    };

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.contract = new ethers.Contract(
      this.config.contractAddress,
      PrivateMixerABI.abi,
      this.provider
    );
  }

  public static getInstance(): EventIndexer {
    if (!EventIndexer.instance) {
      EventIndexer.instance = new EventIndexer();
    }
    return EventIndexer.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info("Initializing EventIndexer...");

      // Verify contract exists
      const code = await this.provider.getCode(this.config.contractAddress);
      if (code === "0x") {
        throw new Error(
          `No contract found at address ${this.config.contractAddress}`
        );
      }

      // Find contract creation block if not specified
      if (this.config.startBlock === 0) {
        logger.info("Finding contract creation block...");
        this.config.startBlock = await this.findContractCreationBlock();
        logger.info(`Contract created at block ${this.config.startBlock}`);
      }

      // Set up connection error handling
      this.setupConnectionRecovery();

      // Start indexing
      await this.startIndexing();

      this.isInitialized = true;
      logger.info("EventIndexer initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize EventIndexer:", error);
      throw error;
    }
  }

  private async findContractCreationBlock(): Promise<number> {
    const currentBlock = await this.provider.getBlockNumber();
    let left = 0;
    let right = currentBlock;
    let creationBlock = currentBlock;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const code = await this.provider.getCode(
        this.config.contractAddress,
        mid
      );

      if (code === "0x") {
        left = mid + 1;
      } else {
        creationBlock = mid;
        right = mid - 1;
      }
    }

    return creationBlock;
  }

  private async startIndexing(): Promise<void> {
    logger.info(
      `Starting to index events from block ${this.config.startBlock}...`
    );

    // Index historical events
    await this.indexHistoricalEvents();

    // Set up listener for new events
    this.setupEventListener();
  }

  private async indexHistoricalEvents(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.config.startBlock;
      const toBlock = currentBlock - this.config.confirmations;

      if (fromBlock > toBlock) {
        logger.info("No historical events to index");
        this.lastProcessedBlock = currentBlock - this.config.confirmations;
        return;
      }

      logger.info(`Indexing events from block ${fromBlock} to ${toBlock}...`);

      const filter = this.contract.filters.LeafInserted();
      const events = await this.contract.queryFilter(
        filter,
        fromBlock,
        toBlock
      );

      logger.info(`Found ${events.length} leaf insertion events`);

      // Get MerkleTreeService instance
      const merkleTreeService = MerkleTreeService.getInstance();

      for (const event of events) {
        await this.processLeafInsertedEvent(event, merkleTreeService);
      }

      // Update last processed block
      this.lastProcessedBlock = toBlock;

      logger.info("Historical event indexing complete");
    } catch (error) {
      logger.error("Error indexing historical events:", error);
      throw error;
    }
  }

  private setupEventListener(): void {
    logger.info("Setting up real-time event listener...");

    const merkleTreeService = MerkleTreeService.getInstance();

    // Fix: Correct signature for real-time events
    this.contract.on(
      this.contract.filters.LeafInserted(),
      async (leafIndex, leaf, newRoot, event) => {
        try {
          logger.info(`Real-time event received: leafIndex=${leafIndex}, leaf=${leaf}, newRoot=${newRoot}`);

          // Create event ID for deduplication
          const eventId = `${event.transactionHash}-${event.index}`;

          if (this.processedEvents.has(eventId)) {
            logger.info(`Event ${eventId} already processed, skipping`);
            return;
          }

          // Process the event
          await this.processRealTimeEvent(leafIndex, leaf, newRoot, event, merkleTreeService);

          // Mark as processed
          this.processedEvents.add(eventId);

          // Update last processed block
          this.lastProcessedBlock = Math.max(this.lastProcessedBlock, event.blockNumber);

        } catch (error) {
          logger.error(
            "Error processing real-time leaf insertion event:",
            error
          );
        }
      }
    );

    // Set up periodic sync to catch missed events
    this.setupPeriodicSync();
  }

  private async processLeafInsertedEvent(
    event: ethers.EventLog | ethers.Log,
    merkleTreeService: MerkleTreeService
  ): Promise<void> {
    try {
      this.processEvent(event, merkleTreeService);
    } catch (error) {
      logger.error("Error processing leaf insertion event:", error);
      throw error;
    }
  }

  private async processRealTimeEvent(
    leafIndex: bigint,
    leaf: bigint,
    newRoot: bigint,
    event: ethers.EventLog,
    merkleTreeService: MerkleTreeService
  ): Promise<void> {
    logger.info(
      `Processing real-time leaf insertion: leafIndex=${leafIndex}, leaf=${leaf}, newRoot=${newRoot}, block=${event.blockNumber}`
    );

    // Add to Merkle tree (leaf is the commitment)
    merkleTreeService.addLeaf(leaf.toString());

    console.log("Current root", merkleTreeService.getRoot());
  }

  private processEvent(event: ethers.EventLog | ethers.Log, merkleTreeService: MerkleTreeService) {
    let leafIndex: bigint, leaf: bigint, newRoot: bigint;

    if ('args' in event && event.args) {
      // EventLog with parsed arguments
      [leafIndex, leaf, newRoot] = event.args;
    } else {
      // Raw Log - need to decode manually
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      [leafIndex, leaf, newRoot] = abiCoder.decode([
        "uint256",
        "uint256",
        "uint256",
      ], event.data);
    }

    // Create event ID for deduplication
    const eventId = `${event.transactionHash}-${event.index}`;

    if (this.processedEvents.has(eventId)) {
      logger.info(`Event ${eventId} already processed, skipping`);
      return;
    }

    logger.info(
      `Processing historical leaf insertion: leafIndex=${leafIndex}, leaf=${leaf}, newRoot=${newRoot}`
    );

    // Add to Merkle tree (leaf is the commitment)
    merkleTreeService.addLeaf(leaf.toString());

    // Mark as processed
    this.processedEvents.add(eventId);

    console.log("Current root", merkleTreeService.getRoot());
  }

  private setupPeriodicSync(): void {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Set up periodic sync every 30 seconds to catch missed events
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncMissedEvents();
      } catch (error) {
        logger.error("Error during periodic sync:", error);
      }
    }, 30000); // 30 seconds

    logger.info("Periodic sync set up to run every 30 seconds");
  }

  private async syncMissedEvents(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(this.lastProcessedBlock + 1, this.config.startBlock);
      const toBlock = currentBlock - this.config.confirmations;

      if (fromBlock > toBlock) {
        return; // No new blocks to process
      }

      logger.info(`Syncing missed events from block ${fromBlock} to ${toBlock}`);

      const filter = this.contract.filters.LeafInserted();
      const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

      if (events.length > 0) {
        logger.info(`Found ${events.length} potentially missed events`);

        const merkleTreeService = MerkleTreeService.getInstance();

        for (const event of events) {
          await this.processLeafInsertedEvent(event, merkleTreeService);
        }

        // Update last processed block
        this.lastProcessedBlock = toBlock;
      }
    } catch (error) {
      logger.error("Error syncing missed events:", error);
    }
  }

  private setupConnectionRecovery(): void {
    // Handle provider errors and reconnection
    this.provider.on("error", (error) => {
      logger.error("Provider error:", error);
      // The periodic sync will help recover from missed events
    });

    // Handle network changes
    this.provider.on("network", (newNetwork, oldNetwork) => {
      if (oldNetwork) {
        logger.info(`Network changed from ${oldNetwork.chainId} to ${newNetwork.chainId}`);
        // Re-setup event listeners on network change
        this.setupEventListener();
      }
    });
  }

  public cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Remove all event listeners
    this.contract.removeAllListeners();
    this.provider.removeAllListeners();

    logger.info("EventIndexer cleanup completed");
  }
}
