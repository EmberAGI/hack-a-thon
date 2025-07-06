#!/usr/bin/env node
/**
 * Direct Distribution Test
 * Tests the distributePayment function directly without going through the agent
 */

import { createPublicClient, http, parseUnits } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'payment-agent', '.env') });

// Import the distribution function from the built agent
import { distributePayment } from './payment-agent/dist/tools/distributionLogic.js';

// Get addresses from env
const PAYMENT_AGENT_ADDRESS = process.env.PAYMENT_AGENT_ADDRESS;
const SCOPE_AGENT_ADDRESS = process.env.SCOPE_AGENT_ADDRESS;
const CODER_AGENT_ADDRESS = process.env.CODER_AGENT_ADDRESS;

// USDC contract
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// USDC ABI for balance checks
const USDC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function checkBalances(publicClient) {
  const addresses = {
    'Payment Agent': PAYMENT_AGENT_ADDRESS,
    'Scope Agent': SCOPE_AGENT_ADDRESS,
    'Coder Agent': CODER_AGENT_ADDRESS,
  };

  log('\n💰 Current USDC Balances:', colors.yellow);
  
  const balances = {};
  for (const [name, address] of Object.entries(addresses)) {
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    
    const balanceInUsdc = Number(balance) / 1e6;
    balances[name] = balanceInUsdc;
    log(`  ${name}: ${balanceInUsdc} USDC`, colors.cyan);
  }
  
  return balances;
}

async function testDistribution() {
  log('\n🧪 Direct Distribution Test', colors.bright + colors.blue);
  log('===========================\n', colors.blue);

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(),
  });

  // Check initial balances
  const initialBalances = await checkBalances(publicClient);
  
  // Check Payment Agent has USDC to distribute
  if (initialBalances['Payment Agent'] < 1) {
    log('❌ Payment Agent needs at least 1 USDC to test distribution', colors.red);
    log('   Run the main demo first to get some USDC', colors.yellow);
    process.exit(1);
  }

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({ address: PAYMENT_AGENT_ADDRESS });
  if (ethBalance === 0n) {
    log('❌ Payment Agent needs ETH for gas fees', colors.red);
    log(`   Send ETH to: ${PAYMENT_AGENT_ADDRESS}`, colors.yellow);
    process.exit(1);
  }
  log(`✅ Payment Agent has ${Number(ethBalance) / 1e18} ETH for gas`, colors.green);

  log('\n📊 Test Parameters:', colors.yellow);
  const testAmount = parseUnits('1', 6); // 1 USDC
  const splitPercentage = 60;
  
  log(`  Total to distribute: 1 USDC`, colors.cyan);
  log(`  Split: ${splitPercentage}% to Scope, ${100 - splitPercentage}% to Coder`, colors.cyan);

  try {
    log('\n🚀 Calling distributePayment function directly...', colors.yellow);
    
    // Call the distribution function directly
    const result = await distributePayment(testAmount, splitPercentage);
    
    if (result.success) {
      log('\n✨ Distribution successful!', colors.bright + colors.green);
      log(`  Scope Agent TX: ${result.scopeTx}`, colors.green);
      log(`  Coder Agent TX: ${result.coderTx}`, colors.green);
      
      // Wait a bit for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check final balances
      log('\n📊 Final Balance Check:', colors.bright + colors.yellow);
      const finalBalances = await checkBalances(publicClient);
      
      // Show changes
      log('\n📈 Balance Changes:', colors.yellow);
      for (const name of ['Payment Agent', 'Scope Agent', 'Coder Agent']) {
        const change = finalBalances[name] - initialBalances[name];
        if (change !== 0) {
          const sign = change > 0 ? '+' : '';
          log(`  ${name}: ${sign}${change.toFixed(6)} USDC`, change > 0 ? colors.green : colors.red);
        }
      }
    } else {
      log(`\n❌ Distribution failed: ${result.error}`, colors.red);
    }
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

testDistribution().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.bright + colors.red);
  console.error(error);
  process.exit(1);
}); 