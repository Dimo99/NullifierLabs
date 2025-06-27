import { useState, useCallback, useRef, useEffect } from 'react';
import { MouseEntropyCollector } from '../utils/crypto';

interface UseEntropyCollectionReturn {
  progress: number;
  isCollecting: boolean;
  startCollection: () => void;
  stopCollection: () => void;
}

export function useEntropyCollection(
  onComplete?: (secretKey: string) => void
): UseEntropyCollectionReturn {
  const [progress, setProgress] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  
  // Use refs to maintain stable references across re-renders
  const collectorRef = useRef<MouseEntropyCollector | null>(null);
  const onCompleteRef = useRef(onComplete);
  
  // Keep the callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (collectorRef.current) {
        collectorRef.current.stopCollection();
        collectorRef.current = null;
      }
    };
  }, []);
  
  const startCollection = useCallback(() => {
    // Clean up any existing collector
    if (collectorRef.current) {
      collectorRef.current.stopCollection();
    }
    
    setIsCollecting(true);
    setProgress(0);
    
    // Create new collector with stable callback references
    const collector = new MouseEntropyCollector(
      (newProgress) => {
        setProgress(newProgress);
      },
      (secretKey) => {
        setIsCollecting(false);
        // Use the ref to get the latest callback
        onCompleteRef.current?.(secretKey);
      }
    );
    
    collectorRef.current = collector;
    collector.startCollection();
  }, []);
  
  const stopCollection = useCallback(() => {
    if (collectorRef.current) {
      collectorRef.current.stopCollection();
      collectorRef.current = null;
    }
    setIsCollecting(false);
    setProgress(0);
  }, []);
  
  return {
    progress,
    isCollecting,
    startCollection,
    stopCollection
  };
}
