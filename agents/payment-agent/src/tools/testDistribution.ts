/**
 * Test Distribution Tool
 * Manually triggers the distribution logic without waiting for CCTP events
 * For testing purposes only
 */

import { z } from 'zod';
import type { VibkitToolDefinition } from 'arbitrum-vibekit-core';
import { createSuccessTask } from 'arbitrum-vibekit-core';
import { parseUnits, createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { distributePayment } from './distributionLogic.js';

const TestDistributionParams = z.object({
  amount: z.string().describe('Amount of USDC to distribute (already in Payment Agent)'),
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
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Contract addresses
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const PAYMENT_AGENT_ADDRESS = process.env.PAYMENT_AGENT_ADDRESS!;
const PAYMENT_AGENT_PRIVATE_KEY = process.env.PAYMENT_AGENT_PRIVATE_KEY!;
const SCOPE_AGENT_ADDRESS = process.env.SCOPE_AGENT_ADDRESS!;
const CODER_AGENT_ADDRESS = process.env.CODER_AGENT_ADDRESS!;

// Create public client for balance checks
const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'),
});

export const testDistributionTool: VibkitToolDefinition<typeof TestDistributionParams> = {
  name: 'test-distribution',
  description: 'Test the distribution logic without waiting for CCTP (dev only)',
  parameters: TestDistributionParams,
  execute: async (args) => {
    console.log('[TestDistribution] Starting manual distribution test...');
    
    try {
      // Parse amount to USDC decimals (6)
      const amountInUnits = parseUnits(args.amount, 6);
      
      // Check current balance
      const currentBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [PAYMENT_AGENT_ADDRESS as `0x${string}`],
      });
      
      if (currentBalance < amountInUnits) {
        throw new Error(`Insufficient USDC balance. Have: ${Number(currentBalance) / 1e6}, Need: ${args.amount}`);
      }
      
      // Check ETH balance
      const ethBalance = await publicClient.getBalance({ 
        address: PAYMENT_AGENT_ADDRESS as `0x${string}` 
      });
      
      if (ethBalance === 0n) {
        throw new Error('Payment Agent has no ETH for gas fees');
      }
      
      console.log('[TestDistribution] Using shared distribution logic...');
      
      // Use the shared distribution function
      const distributionResult = await distributePayment(amountInUnits, args.splitPercentage);
      
      if (!distributionResult.success) {
        throw new Error(distributionResult.error || 'Distribution failed');
      }
      
      console.log('[TestDistribution] Distribution complete!');
      
      // Calculate amounts for result
      const scopeAmount = (amountInUnits * BigInt(args.splitPercentage)) / 100n;
      const coderAmount = amountInUnits - scopeAmount;
      
      // Return results
      const result = {
        success: true,
        distributed: {
          total: args.amount,
          scopeAgent: {
            amount: Number(scopeAmount) / 1e6,
            percentage: args.splitPercentage,
            txHash: distributionResult.scopeTx || '',
            blockNumber: distributionResult.scopeBlockNumber?.toString() || '',
          },
          coderAgent: {
            amount: Number(coderAmount) / 1e6,
            percentage: 100 - args.splitPercentage,
            txHash: distributionResult.coderTx || '',
            blockNumber: distributionResult.coderBlockNumber?.toString() || '',
          },
        },
        message: 'Test distribution completed successfully using shared distribution logic',
      };
      
      return createSuccessTask(
        'test-distribution-complete',
        undefined,
        JSON.stringify(result, null, 2)
      );
      
    } catch (error: any) {
      console.error('[TestDistribution] Failed:', error);
      throw error;
    }
  },
}; 