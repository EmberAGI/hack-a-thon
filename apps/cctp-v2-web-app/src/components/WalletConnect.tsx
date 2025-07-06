"use client";

import { usePrivy } from "@privy-io/react-auth";
import { WalletButton } from "@/components/ui/WalletButton";
import { Wallet, LogOut, User, CheckCircle } from "lucide-react";

export function WalletConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  // Don't render anything until Privy is ready
  if (!ready) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75"></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></div>
      </div>
    );
  }

  // If user is authenticated, show user info and logout
  if (authenticated && user) {
    const walletAddress = user.wallet?.address;
    const displayAddress = walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : "Connected";

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-green-50/80 backdrop-blur-sm border border-green-200/60 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-green-600 font-medium">Connected</span>
            <span className="text-sm text-green-800 font-mono">
              {displayAddress}
            </span>
          </div>
        </div>
        <WalletButton
          variant="outline"
          size="sm"
          onClick={logout}
          className="text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </WalletButton>
      </div>
    );
  }

  // If not authenticated, show connect button
  return (
    <WalletButton 
      onClick={login}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg border-0 px-6 py-2.5"
    >
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </WalletButton>
  );
}
