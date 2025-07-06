"use client";

import { useCreateWallet } from "@privy-io/react-auth";
import { useState } from "react";

export interface CreatedWallet {
  address: string;
  chainType: "ethereum" | "solana";
  createdAt: Date;
  id: string;
}

export function useWalletCreation() {
  const [createdWallets, setCreatedWallets] = useState<CreatedWallet[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const { createWallet } = useCreateWallet({
    onSuccess: ({ wallet }) => {
      console.log("Successfully created wallet:", wallet);
      
      // Add to our local state
      const newWallet: CreatedWallet = {
        address: wallet.address,
        chainType: wallet.chainType as "ethereum" | "solana",
        createdAt: new Date(),
        id: wallet.address, // Use address as ID for simplicity
      };
      
      setCreatedWallets(prev => [...prev, newWallet]);
      setCreationError(null);
      setIsCreating(false);
    },
    onError: (error) => {
      console.error("Failed to create wallet:", error);
      setCreationError(error);
      setIsCreating(false);
    },
  });

  const createNewWallet = async (createAdditional: boolean = false) => {
    setIsCreating(true);
    setCreationError(null);
    
    try {
      await createWallet({ createAdditional });
    } catch (error) {
      console.error("Error creating wallet:", error);
      setCreationError(error instanceof Error ? error.message : "Unknown error");
      setIsCreating(false);
    }
  };

  const getWalletsByChainType = (chainType: "ethereum" | "solana") => {
    return createdWallets.filter(wallet => wallet.chainType === chainType);
  };

  const clearError = () => {
    setCreationError(null);
  };

  return {
    createdWallets,
    isCreating,
    creationError,
    createNewWallet,
    getWalletsByChainType,
    clearError,
  };
}
