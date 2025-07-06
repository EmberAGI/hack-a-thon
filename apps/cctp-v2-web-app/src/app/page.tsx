"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCrossChainTransfer } from "@/hooks/use-cross-chain-transfer";
import { useWalletIntegration } from "@/hooks/useWalletIntegration";
import { WalletConnect } from "@/components/WalletConnect";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  SupportedChainId,
  SUPPORTED_CHAINS,
  CHAIN_TO_CHAIN_NAME,
} from "@/lib/chains";
import { ProgressSteps } from "@/components/progress-step";
import { TransferLog } from "@/components/transfer-log";
import { Timer } from "@/components/timer";
import { TransferTypeSelector } from "@/components/transfer-type";
import { ArrowRight, Shield, Zap, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function Home() {
  const searchParams = useSearchParams();
  
  const {
    currentStep,
    logs,
    error,
    executeTransfer,
    getBalance,
    reset,
    isWalletConnected,
    walletAddress,
  } = useCrossChainTransfer();
  
  const {
    currentChainId,
    isSwitchingChain,
    chainSwitchError,
    switchChain,
    isOnCorrectChain,
  } = useWalletIntegration();
  
  const [sourceChain, setSourceChain] = useState<SupportedChainId>(
    SupportedChainId.ETH_SEPOLIA
  );
  const [destinationChain, setDestinationChain] = useState<SupportedChainId>(
    SupportedChainId.ARBITRUM_SEPOLIA
  );
  const [amount, setAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showFinalTime, setShowFinalTime] = useState(false);
  const [transferType, setTransferType] = useState<"fast" | "standard">("fast");
  const [balance, setBalance] = useState("0");
  const [ensName, setEnsName] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [isResolvingEns, setIsResolvingEns] = useState(false);
  const [ensError, setEnsError] = useState<string | null>(null);
  const [transferStarted, setTransferStarted] = useState(false);

  // ENS resolution function
  const resolveEnsName = async (ensName: string): Promise<string | null> => {
    try {
      setIsResolvingEns(true);
      setEnsError(null);
      
      // Use a public Ethereum mainnet RPC to resolve ENS
      const { createPublicClient, http } = await import("viem");
      const { mainnet } = await import("viem/chains");
      
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http("https://eth.llamarpc.com"),
      });
      
      const address = await publicClient.getEnsAddress({
        name: ensName,
      });
      
      return address;
    } catch (error) {
      console.error("ENS resolution failed:", error);
      setEnsError(`Failed to resolve ENS name: ${ensName}`);
      return null;
    } finally {
      setIsResolvingEns(false);
    }
  };

  // Handle destination address changes and ENS resolution
  const handleDestinationAddressChange = async (value: string) => {
    setDestinationAddress(value);
    
    if (value.endsWith(".eth")) {
      setEnsName(value);
      const resolved = await resolveEnsName(value);
      if (resolved) {
        setResolvedAddress(resolved);
      }
    } else {
      setEnsName("");
      setResolvedAddress("");
      setEnsError(null);
    }
  };

  // Initialize from URL parameters
  useEffect(() => {
    const amountParam = searchParams.get("amount");
    const ensParam = searchParams.get("ens");
    
    // Set amount if provided
    if (amountParam && !isNaN(parseFloat(amountParam))) {
      setAmount(amountParam);
    }
    
    // Set destination address directly from URL parameter (no resolution here)
    if (ensParam) {
      setDestinationAddress(ensParam);
    }
  }, [searchParams]);

  const handleStartTransfer = async () => {
    setIsTransferring(true);
    setTransferStarted(true);
    setShowFinalTime(false);
    setElapsedSeconds(0);
    try {
      await executeTransfer(
        sourceChain,
        destinationChain,
        amount,
        transferType,
        destinationAddress
      );
    } catch (error) {
      console.error("Transfer failed:", error);
    } finally {
      setIsTransferring(false);
      setShowFinalTime(true);
    }
  };

  const handleReset = () => {
    reset();
    setIsTransferring(false);
    setShowFinalTime(false);
    setElapsedSeconds(0);
  };

  useEffect(() => {
    const wrapper = async () => {
      try {
        // Only fetch balance when wallet is connected
        if (isWalletConnected) {
          const balance = await getBalance(sourceChain);
          setBalance(balance);
        } else {
          // Show "0" when wallet is not connected
          setBalance("0");
        }
      } catch (error) {
        console.error("Failed to get balance:", error);
        setBalance("0");
      }
    };
    wrapper();
  }, [sourceChain, isWalletConnected, getBalance]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Cross-Chain Transfer
                </h1>
                <p className="text-sm text-slate-500">Powered by Circle CCTP</p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Transfer USDC Across Chains
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Send USDC seamlessly between Ethereum, Arbitrum, and Solana with institutional-grade security
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Secure</h3>
                <p className="text-sm text-slate-600">Circle's native protocol</p>
              </div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Fast</h3>
                <p className="text-sm text-slate-600">Minutes, not hours</p>
              </div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/60">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Real-time</h3>
                <p className="text-sm text-slate-600">Live progress tracking</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Form */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl text-center text-slate-900">
              Configure Transfer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Chain Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium text-slate-900">Route</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">From</Label>
                  <Select
                    value={String(sourceChain)}
                    onValueChange={(value) => setSourceChain(Number(value))}
                  >
                    <SelectTrigger className="h-12 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select source chain" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CHAINS.map((chainId) => (
                        <SelectItem key={chainId} value={String(chainId)}>
                          {CHAIN_TO_CHAIN_NAME[chainId]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">To</Label>
                  <Select
                    value={String(destinationChain)}
                    onValueChange={(value) => setDestinationChain(Number(value))}
                    disabled={true}
                  >
                    <SelectTrigger className="h-12 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="Select destination chain" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CHAINS.filter(
                        (chainId) => chainId !== sourceChain
                      ).map((chainId) => (
                        <SelectItem key={chainId} value={String(chainId)}>
                          {CHAIN_TO_CHAIN_NAME[chainId]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Chain Mismatch Warning */}
            {isWalletConnected && currentChainId && !isOnCorrectChain(sourceChain) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">
                      Network Switch Required
                    </h3>
                    <p className="text-sm text-amber-800 mb-3">
                      Your wallet is connected to{" "}
                      <span className="font-medium">
                        {CHAIN_TO_CHAIN_NAME[currentChainId] || `Chain ${currentChainId}`}
                      </span>{" "}
                      but you need{" "}
                      <span className="font-medium">
                        {CHAIN_TO_CHAIN_NAME[sourceChain]}
                      </span>{" "}
                      for this transfer.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => switchChain(sourceChain)}
                      disabled={isSwitchingChain}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {isSwitchingChain
                        ? "Switching..."
                        : `Switch to ${CHAIN_TO_CHAIN_NAME[sourceChain]}`}
                    </Button>
                    {chainSwitchError && (
                      <p className="text-sm text-red-600 mt-2">{chainSwitchError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-slate-900">Amount</Label>
              <div className="relative">
                <span className="text-xl font-bold">{amount} </span> USDC
                <Input
                  
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max={parseFloat(balance)}
                  step="any"
                  className="h-14 text-lg bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 pr-16 hidden"
                />

              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Balance: <span className="font-medium">{balance} USDC</span>
                </p>

              </div>
            </div>

            {/* Destination Address Input */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-slate-900">Destination Address</Label>
              <div className="relative">
                <span className="text-xl font-bold">
                    {destinationAddress}
                  </span>
                <Input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="0x... or vitalik.eth"
                  className="h-12 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 hidden"
                />
              </div>
              <p className="text-sm text-slate-600">
                
              </p>
            </div>


            {/* Progress Steps - Only show after transfer starts */}
            {transferStarted && <ProgressSteps currentStep={currentStep} />}

            {/* Transfer Log - Only show after transfer starts */}
            {transferStarted && <TransferLog logs={logs} />}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800 font-medium">Transfer Failed</p>
                </div>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 pt-4">
              <Button
                onClick={handleStartTransfer}
                disabled={
                  isTransferring || 
                  currentStep === "completed" || 
                  (isWalletConnected && currentChainId && !isOnCorrectChain(sourceChain)) ||
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  !destinationAddress.trim()
                }
                size="lg"
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg"
              >
                {currentStep === "completed"
                  ? "Transfer Complete"
                  : isWalletConnected && currentChainId && !isOnCorrectChain(sourceChain)
                  ? "Switch Network First"
                  : isTransferring
                  ? "Processing..."
                  : "Start Transfer"}
              </Button>
              {(currentStep === "completed" || currentStep === "error") && (
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  size="lg"
                  className="px-8 py-3 border-slate-300 hover:bg-slate-50"
                >
                  New Transfer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
