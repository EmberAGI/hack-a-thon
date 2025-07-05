"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { SupportedChainId } from "@/lib/chains";

export function useWalletIntegration() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [currentChainId, setCurrentChainId] = useState<SupportedChainId | null>(
    null
  );

  // Get the primary wallet
  const primaryWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );
  const connectedWallet = primaryWallet || wallets[0];

  // Helper function to get wallet address
  const getWalletAddress = () => {
    return connectedWallet?.address || user?.wallet?.address || null;
  };

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
          setCurrentChainId(parseInt(chainId, 16) as SupportedChainId);
        }
      } catch (error) {
        console.error("Failed to setup wallet client:", error);
      }
    };

    setupWalletClient();
  }, [ready, authenticated, connectedWallet]);

  const switchChain = async (chainId: SupportedChainId) => {
    if (!connectedWallet) return false;

    try {
      await connectedWallet.switchChain(chainId);
      setCurrentChainId(chainId);
      return true;
    } catch (error) {
      console.error("Failed to switch chain:", error);
      return false;
    }
  };

  const isWalletConnected = () => {
    return ready && authenticated && !!connectedWallet;
  };

  return {
    isReady: ready,
    isConnected: isWalletConnected(),
    walletClient,
    currentChainId,
    walletAddress: getWalletAddress(),
    connectedWallet,
    switchChain,
  };
}
