"use client";

import { usePrivy } from "@privy-io/react-auth";
import { WalletButton } from "@/components/ui/WalletButton";
import { Wallet, LogOut, User } from "lucide-react";

export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  // Don't render anything until Privy is ready
  if (!ready) {
    return (
      <WalletButton disabled>
        <Wallet className="mr-2 h-4 w-4" />
        Loading...
      </WalletButton>
    );
  }

  // If user is authenticated, show user info and logout
  if (authenticated && user) {
    const walletAddress = user.wallet?.address;
    const displayAddress = walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : "Connected";

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
          <User className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">
            {displayAddress}
          </span>
        </div>
        <WalletButton
          variant="outline"
          size="sm"
          onClick={logout}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
        </WalletButton>
      </div>
    );
  }

  // If not authenticated, show connect button
  return (
    <WalletButton onClick={login}>
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </WalletButton>
  );
}
