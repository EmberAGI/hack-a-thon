"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWalletCreation } from "@/hooks/useWalletCreation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Wallet, UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";

export function SignupWithWallet() {
  const { ready, authenticated, user, login } = usePrivy();
  const { createNewWallet, isCreating, creationError, clearError } = useWalletCreation();
  const [showSuccess, setShowSuccess] = useState(false);

  // Don't render anything until Privy is ready
  if (!ready) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If user is already authenticated and has a wallet
  if (authenticated && user?.wallet) {
    const walletAddress = user.wallet.address;
    const displayAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Wallet Ready
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <Wallet className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-700">
                Your wallet is ready to use!
              </p>
              <p className="text-xs text-green-600 font-mono mt-1">
                {displayAddress}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              You can now perform cross-chain transfers and other wallet operations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If user is authenticated but doesn't have a wallet yet
  if (authenticated && !user?.wallet) {
    const handleCreateWallet = async () => {
      try {
        await createNewWallet();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (error) {
        console.error("Failed to create wallet:", error);
      }
    };

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Create Your Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            You're signed in! Now create your embedded wallet to start using the app.
          </p>
          
          {creationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm text-red-700 font-medium">
                    Failed to create wallet
                  </p>
                  <p className="text-xs text-red-600 mt-1">{creationError}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearError}
                    className="text-red-600 hover:text-red-700 p-0 h-auto mt-1"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">
                  Wallet created successfully!
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleCreateWallet}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Wallet...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Create Wallet
              </>
            )}
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            Your wallet will be securely created and managed by Privy
          </p>
        </CardContent>
      </Card>
    );
  }

  // If not authenticated, show signup button
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Sign Up & Create Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Get started by signing up and creating your secure embedded wallet.
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Secure embedded wallet</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Cross-chain transfers</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>No seed phrase required</span>
          </div>
        </div>

        <Button onClick={login} className="w-full">
          <UserPlus className="mr-2 h-4 w-4" />
          Sign Up & Create Wallet
        </Button>
        
        <p className="text-xs text-gray-500 text-center">
          By signing up, you agree to our terms of service. Your wallet will be automatically created upon signup.
        </p>
      </CardContent>
    </Card>
  );
}
