/**
 * Payment Processing Skill
 * Handles USDC payment transaction creation and automatic fund distribution
 */

import { z } from 'zod';
import { defineSkill } from 'arbitrum-vibekit-core';
import { createPaymentTransactionTool } from '../tools/createPaymentTransaction.js';

// Input schema for the payment processing skill
const PaymentInputSchema = z.object({
  amount: z.string().describe('Amount of USDC to request (e.g., "100")'),
  payerAddress: z.string().describe('Ethereum address of the payer'),
  splitPercentage: z.number().min(0).max(100).default(50).describe('Percentage to send to Scope Agent (remainder goes to Coder Agent)'),
});

export const paymentProcessingSkill = defineSkill({
  id: 'payment-processing',
  name: 'payment-processing',
  description: 'Generate USDC payment transactions and automatically distribute funds upon receipt',
  
  // Required tags and examples
  tags: ['payment', 'usdc', 'distribution', 'hackathon'],
  examples: [
    'Create a payment request for 100 USDC from 0x123...',
    'Generate transaction for 50 USDC with 70/30 split',
    'Request payment of 25 USDC with equal distribution',
  ],
  
  // Schema
  inputSchema: PaymentInputSchema,
  
  // Tools - single tool that handles entire workflow
  tools: [createPaymentTransactionTool],
  
  // Manual handler - directly call the tool without requiring LLM
  handler: async (input) => {
    // Since we only have one tool, directly execute it
    // The tool doesn't use context, so we pass a minimal object
    return createPaymentTransactionTool.execute(input, {} as any);
  },
}); 