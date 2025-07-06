/**
 * Create Payment Transaction Tool
 * Generates unsigned USDC transaction data and starts a listener for automatic distribution
 */

import { z } from 'zod';
import type { VibkitToolDefinition } from 'arbitrum-vibekit-core';
import { createSuccessTask } from 'arbitrum-vibekit-core';
import { 
  encodeFunctionData, 
  parseUnits, 
  createPublicClient,
  http,
  parseAbiItem,
  type Log
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { distributePayment } from './distributionLogic.js';

const CreatePaymentParams = z.object({
  amount: z.string().describe('Amount of USDC to request'),
  payerAddress: z.string().describe('Ethereum address of the payer'),
  splitPercentage: z.number().min(0).max(100).describe('Percentage for Scope Agent'),
});

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

// CCTP contract addresses on Arbitrum Sepolia
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'; // Arbitrum Sepolia USDC
const TOKEN_MESSENGER_ADDRESS = '0x9f3b8679c73c2fef8b59b4f3444d4e156fb70aa5'; // Fixed: correct TokenMessenger address
const PAYMENT_AGENT_ADDRESS = process.env.PAYMENT_AGENT_ADDRESS!;

// MintAndWithdraw event ABI
const MINT_AND_WITHDRAW_EVENT = parseAbiItem(
  'event MintAndWithdraw(address indexed mintRecipient, uint256 amount, address indexed mintToken)'
);

// Create public client
const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
});

// Background polling function
async function pollForMintAndDistribute(
  expectedAmount: bigint,
  splitPercentage: number,
  onComplete: (success: boolean, error?: string) => void
) {
  const startTime = Date.now();
  const timeout = 2.5 * 60 * 1000; // 2.5 minutes
  const pollInterval = 1000; // 1 second
  
  console.log('[PaymentListener] Starting CCTP mint detection...');
  console.log(`[PaymentListener] Watching for ${expectedAmount} USDC to ${PAYMENT_AGENT_ADDRESS}`);
  
  const checkForMint = async () => {
    try {
      // Check if timeout reached
      if (Date.now() - startTime > timeout) {
        console.log('[PaymentListener] Timeout reached, stopping listener');
        onComplete(false, 'Timeout waiting for payment');
        return;
      }
      
      // Get recent blocks (last 10 blocks to handle any delays)
      const currentBlock = await publicClient.getBlockNumber();
      const fromBlock = currentBlock > 10n ? currentBlock - 10n : 0n;
      
      // Get MintAndWithdraw events
      const logs = await publicClient.getLogs({
        address: TOKEN_MESSENGER_ADDRESS,
        event: MINT_AND_WITHDRAW_EVENT,
        fromBlock,
        toBlock: currentBlock,
        args: {
          mintRecipient: PAYMENT_AGENT_ADDRESS as `0x${string}`,
          mintToken: USDC_ADDRESS as `0x${string}`,
        },
      });
      
      // Check if we found a matching mint
      const matchingMint = logs.find(log => log.args.amount === expectedAmount);
      
      if (matchingMint) {
        console.log('[PaymentListener] CCTP mint detected!', {
          amount: matchingMint.args.amount?.toString(),
          block: matchingMint.blockNumber,
          txHash: matchingMint.transactionHash,
        });
        
        // Use shared distribution logic
        const result = await distributePayment(expectedAmount, splitPercentage);
        
        if (result.success) {
          console.log('[PaymentListener] Payment received and distributed successfully');
          onComplete(true);
        } else {
          console.error('[PaymentListener] Payment flow failed:', result.error);
          onComplete(false, result.error);
        }
      } else {
        // Continue polling
        setTimeout(checkForMint, pollInterval);
      }
    } catch (error) {
      console.error('[PaymentListener] Error during polling:', error);
      // Continue polling despite errors
      setTimeout(checkForMint, pollInterval);
    }
  };
  
  // Start polling
  checkForMint();
}

export const createPaymentTransactionTool: VibkitToolDefinition<typeof CreatePaymentParams> = {
  name: 'create-payment-transaction',
  description: 'Generate unsigned USDC transaction data and start payment listener',
  parameters: CreatePaymentParams,
  execute: async (args) => {
    console.log('[CreatePaymentTransaction] Starting with args:', args);
    
    // Check if Payment Agent has ETH for gas
    const ethBalance = await publicClient.getBalance({ 
      address: PAYMENT_AGENT_ADDRESS as `0x${string}` 
    });
    
    const minGasRequired = parseUnits('0.001', 18); // 0.001 ETH minimum
    if (ethBalance < minGasRequired) {
      console.warn(`[CreatePaymentTransaction] WARNING: Payment Agent has insufficient ETH for gas!`);
      console.warn(`  Current balance: ${Number(ethBalance) / 1e18} ETH`);
      console.warn(`  Minimum required: 0.001 ETH`);
      console.warn(`  Send ETH to: ${PAYMENT_AGENT_ADDRESS}`);
    }
    
    // Parse amount to USDC decimals (6)
    const amountInUnits = parseUnits(args.amount, 6);
    
    // Create unsigned transaction data
    const txData = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [PAYMENT_AGENT_ADDRESS as `0x${string}`, amountInUnits],
    });
    
    // Start background listener
    pollForMintAndDistribute(
      amountInUnits,
      args.splitPercentage,
      (success, error) => {
        if (success) {
          console.log('[CreatePaymentTransaction] Payment received and distributed successfully');
        } else {
          console.error('[CreatePaymentTransaction] Payment flow failed:', error);
        }
      }
    );
    
    console.log('[CreatePaymentTransaction] Transaction data generated');
    console.log('[CreatePaymentTransaction] CCTP mint listener started (1s polling)');
    
    // Return transaction details
    const result = {
      success: true,
      transactionData: {
        to: USDC_ADDRESS,
        data: txData,
        value: '0x0',
        chainId: 421614, // Arbitrum Sepolia
      },
      paymentDetails: {
        amount: args.amount,
        payerAddress: args.payerAddress,
        recipientAddress: PAYMENT_AGENT_ADDRESS,
        splitPercentage: args.splitPercentage,
        scopeAgentAmount: (parseFloat(args.amount) * args.splitPercentage / 100).toFixed(2),
        coderAgentAmount: (parseFloat(args.amount) * (100 - args.splitPercentage) / 100).toFixed(2),
      },
      listenerActive: true,
      message: 'Payment transaction data generated. CCTP mint listener active (1s polling) for automatic distribution upon payment receipt.',
    };
    
    return createSuccessTask(
      'payment-transaction-created',
      undefined,
      JSON.stringify(result, null, 2)
    );
  },
}; 