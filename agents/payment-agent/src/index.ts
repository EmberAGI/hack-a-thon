#!/usr/bin/env node
/**
 * Payment Agent
 * Handles USDC payment requests and automatic fund distribution
 */

import 'dotenv/config';
import { Agent, type AgentConfig } from 'arbitrum-vibekit-core';
import { paymentProcessingSkill } from './skills/payment-processing.js';

// Export agent configuration for testing
export const agentConfig: AgentConfig = {
  name: 'Payment Agent',
  version: '0.1.0',
  description: 'Handles USDC payment requests and automatic fund distribution',
  protocolVersion: '0.1.0',
  skills: [paymentProcessingSkill],
  url: 'localhost',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  defaultInputModes: ['application/json'],
  defaultOutputModes: ['application/json'],
};

// Configure the agent
const agent = Agent.create(agentConfig, {
  cors: true,
});

// Start the agent
const PORT = parseInt(process.env.PORT || '3002', 10);

agent
  .start(PORT)
  .then(() => {
    console.log(`🚀 Payment Agent running on port ${PORT}`);
    console.log(`📍 Base URL: http://localhost:${PORT}`);
    console.log(`🤖 Agent Card: http://localhost:${PORT}/.well-known/agent.json`);
    console.log(`🔌 MCP SSE: http://localhost:${PORT}/sse`);
    console.log('\n💰 Payment Agent Features:');
    console.log('  - Generate USDC payment transactions');
    console.log('  - Automatic payment detection via The Graph');
    console.log('  - Auto-split funds between Scope and Coder agents');
  })
  .catch((error: Error) => {
    console.error('Failed to start agent:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await agent.stop();
  process.exit(0);
}); 