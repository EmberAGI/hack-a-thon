"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState, useCallback } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { SupportedChainId, CHAIN_TO_CHAIN_NAME } from "@/lib/chains";

export function useWalletIntegration() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [currentChainId, setCurrentChainId] = useState<SupportedChainId | null>(
    null
  );
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [chainSwitchError, setChainSwitchError] = useState<string | null>(null);

  // Get the primary wallet
  const primaryWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );
  const connectedWallet = primaryWallet || wallets[0];

  // Helper function to get wallet address
  const getWalletAddress = () => {
    return connectedWallet?.address || user?.wallet?.address || null;
  };

  // Listen for chain changes
  const handleChainChanged = useCallback((chainId: string) => {
    const newChainId = parseInt(chainId, 16) as SupportedChainId;
    console.log(`Chain changed to: ${newChainId} (${CHAIN_TO_CHAIN_NAME[newChainId] || 'Unknown'})`);
    setCurrentChainId(newChainId);
    setChainSwitchError(null);
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || !connectedWallet) {
      setWalletClient(null);
      setCurrentChainId(null);
      return;
    }

    const setupWalletClient = async () => {
      try {
        // Get the EIP-1193 provider from the connected wallet
        const provider = await connectedWallet.getEthereumProvider();
        const walletAddress = getWalletAddress();

        if (provider && walletAddress) {
          const client = createWalletClient({
            transport: custom(provider),
          });

          setWalletClient(client);

          // Get current chain ID
          const chainId = await provider.request({ method: "eth_chainId" });
          const currentChain = parseInt(chainId, 16) as SupportedChainId;
          setCurrentChainId(currentChain);

          // Listen for chain changes
          if (provider.on) {
            (provider as any).on('chainChanged', handleChainChanged);
          }

          console.log(`Wallet connected to chain: ${currentChain} (${CHAIN_TO_CHAIN_NAME[currentChain] || 'Unknown'})`);
        }
      } catch (error) {
        console.error("Failed to setup wallet client:", error);
      }
    };

    setupWalletClient();

    // Cleanup event listeners
    return () => {
      if (connectedWallet) {
        connectedWallet.getEthereumProvider().then(provider => {
          if (provider && (provider as any).removeListener) {
            (provider as any).removeListener('chainChanged', handleChainChanged);
          }
        }).catch(console.error);
      }
    };
  }, [ready, authenticated, connectedWallet, handleChainChanged]);

  const switchChain = async (chainId: SupportedChainId): Promise<boolean> => {
    if (!connectedWallet) {
      setChainSwitchError("No wallet connected");
      return false;
    }

    if (currentChainId === chainId) {
      console.log(`Already on target chain: ${chainId}`);
      return true;
    }

    setIsSwitchingChain(true);
    setChainSwitchError(null);

    try {
      console.log(`Switching from chain ${currentChainId} to ${chainId} (${CHAIN_TO_CHAIN_NAME[chainId]})`);
      
      await connectedWallet.switchChain(chainId);
      
      // Wait a bit for the chain switch to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the switch was successful
      const provider = await connectedWallet.getEthereumProvider();
      const newChainId = await provider.request({ method: "eth_chainId" });
      const actualChainId = parseInt(newChainId, 16) as SupportedChainId;
      
      if (actualChainId === chainId) {
        setCurrentChainId(chainId);
        console.log(`Successfully switched to chain: ${chainId}`);
        return true;
      } else {
        throw new Error(`Chain switch failed: expected ${chainId}, got ${actualChainId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to switch chain:", errorMessage);
      setChainSwitchError(`Failed to switch to ${CHAIN_TO_CHAIN_NAME[chainId]}: ${errorMessage}`);
      return false;
    } finally {
      setIsSwitchingChain(false);
    }
  };

  const isWalletConnected = () => {
    return ready && authenticated && !!connectedWallet;
  };

  const isOnCorrectChain = (requiredChainId: SupportedChainId) => {
    return currentChainId === requiredChainId;
  };

  return {
    isReady: ready,
    isConnected: isWalletConnected(),
    walletClient,
    currentChainId,
    walletAddress: getWalletAddress(),
    connectedWallet,
    switchChain,
    isSwitchingChain,
    chainSwitchError,
    isOnCorrectChain,
  };
}
