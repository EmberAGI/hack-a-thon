/**
 * Shared Distribution Logic
 * This module contains the core distribution logic used by both
 * the CCTP listener and the test tool
 */

import { 
  encodeFunctionData, 
  createPublicClient, 
  createWalletClient,
  http,
  type Hex,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// USDC contract ABI (minimal)
const USDC_ABI = [
  {
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Contract addresses
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

export interface DistributionResult {
  success: boolean;
  scopeTx?: Hex;
  coderTx?: Hex;
  scopeBlockNumber?: bigint;
  coderBlockNumber?: bigint;
  error?: string;
}

/**
 * Core distribution logic that splits USDC between Scope and Coder agents
 * @param amount The amount of USDC to distribute (in smallest units)
 * @param splitPercentage The percentage to send to Scope Agent (0-100)
 * @returns Distribution result with transaction details
 */
export async function distributePayment(
  amount: bigint,
  splitPercentage: number
): Promise<DistributionResult> {
  try {
    // Get addresses from environment
    const PAYMENT_AGENT_ADDRESS = process.env.PAYMENT_AGENT_ADDRESS!;
    const PAYMENT_AGENT_PRIVATE_KEY = process.env.PAYMENT_AGENT_PRIVATE_KEY!;
    const SCOPE_AGENT_ADDRESS = process.env.SCOPE_AGENT_ADDRESS!;
    const CODER_AGENT_ADDRESS = process.env.CODER_AGENT_ADDRESS!;

    // Create clients
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
    });

    const walletClient = createWalletClient({
      chain: arbitrumSepolia,
      transport: http(process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
      account: privateKeyToAccount(PAYMENT_AGENT_PRIVATE_KEY as `0x${string}`),
    });

    // Check ETH balance before attempting distribution
    const ethBalance = await publicClient.getBalance({ 
      address: PAYMENT_AGENT_ADDRESS as `0x${string}` 
    });
    
    if (ethBalance === 0n) {
      console.error('[Distribution] Cannot distribute: Payment Agent has no ETH for gas!');
      console.error(`  Payment Agent address: ${PAYMENT_AGENT_ADDRESS}`);
      console.error('  Please send ETH to the Payment Agent on Arbitrum Sepolia');
      return { success: false, error: 'No ETH for gas fees' };
    }
    
    // Calculate split amounts
    const scopeAmount = (amount * BigInt(splitPercentage)) / 100n;
    const coderAmount = amount - scopeAmount;
    
    console.log('[Distribution] Distributing funds:', {
      scopeAgent: `${scopeAmount} (${splitPercentage}%)`,
      coderAgent: `${coderAmount} (${100 - splitPercentage}%)`,
    });
    
    // Send to Scope Agent
    const scopeTx = await walletClient.sendTransaction({
      to: USDC_ADDRESS as `0x${string}`,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [SCOPE_AGENT_ADDRESS as `0x${string}`, scopeAmount],
      }),
    });
    console.log(`[Distribution] Scope Agent transfer: ${scopeTx}`);
    
    // Wait for Scope Agent transaction to be mined
    const scopeReceipt = await publicClient.waitForTransactionReceipt({
      hash: scopeTx,
    });
    console.log(`[Distribution] Scope Agent transfer confirmed in block ${scopeReceipt.blockNumber}`);
    
    // Send to Coder Agent (nonce will be automatically incremented)
    const coderTx = await walletClient.sendTransaction({
      to: USDC_ADDRESS as `0x${string}`,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [CODER_AGENT_ADDRESS as `0x${string}`, coderAmount],
      }),
    });
    console.log(`[Distribution] Coder Agent transfer: ${coderTx}`);
    
    // Wait for Coder Agent transaction to be mined
    const coderReceipt = await publicClient.waitForTransactionReceipt({
      hash: coderTx,
    });
    console.log(`[Distribution] Coder Agent transfer confirmed in block ${coderReceipt.blockNumber}`);
    
    console.log('[Distribution] Distribution complete!');
    
    return {
      success: true,
      scopeTx,
      coderTx,
      scopeBlockNumber: scopeReceipt.blockNumber,
      coderBlockNumber: coderReceipt.blockNumber,
    };
    
  } catch (error: any) {
    console.error('[Distribution] Distribution failed:', error.shortMessage || error.message);
    if (error.message?.includes('insufficient funds')) {
      console.error('  💡 Tip: Send ETH to Payment Agent:', process.env.PAYMENT_AGENT_ADDRESS);
    }
    return { 
      success: false, 
      error: error.shortMessage || error.message || 'Unknown error' 
    };
  }
} 