#!/usr/bin/env node
/**
 * Seamless Payment Demo Script
 * Combines all payment testing functionality into one automated flow:
 * 1. Verifies Payment Agent is running
 * 2. Creates payment request (starts listener)
 * 3. Immediately executes CCTP transfer
 * 4. Monitors for automatic distribution
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { createWalletClient, createPublicClient, http, parseUnits, parseEventLogs, parseAbiItem } from 'viem';
import { sepolia, arbitrumSepolia, mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { normalize } from 'viem/ens';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'payment-agent', '.env') });

// Configuration
const PAYMENT_AGENT_URL = 'http://localhost:3002';
const PAYMENT_AGENT_SSE = 'http://localhost:3002/sse';
const PAYMENT_AMOUNT = '1'; // 1 USDC
const SPLIT_PERCENTAGE = 60; // 60% to Scope Agent, 40% to Coder Agent

// CCTP Configuration
const USDC_ADDRESS_ETH_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const USDC_ADDRESS_ARB_SEPOLIA = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const TOKEN_MESSENGER_ETH_SEPOLIA = '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5';
const TOKEN_MESSENGER_ARB_SEPOLIA = '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa';
const MESSAGE_TRANSMITTER_ARB_SEPOLIA = '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872';
const DESTINATION_DOMAIN = 3; // Arbitrum domain ID for CCTP
const IRIS_API_URL = 'https://iris-api-sandbox.circle.com/v1/attestations';

// Get wallets from env
const USER_PRIVATE_KEY = process.env.USER_WALLET_PRIVATE_KEY;
const USER_WALLET_ADDRESS = process.env.USER_WALLET_ADDRESS;
const PAYMENT_AGENT_ADDRESS = process.env.PAYMENT_AGENT_ADDRESS;
const SCOPE_AGENT_ADDRESS = process.env.SCOPE_AGENT_ADDRESS;
const CODER_AGENT_ADDRESS = process.env.CODER_AGENT_ADDRESS;

// Get ENS names from env
const PAYMENT_AGENT_ENS = process.env.PAYMENT_AGENT_ENS_NAME || 'payments.agentshawarma.eth';
const SCOPE_AGENT_ENS = process.env.SCOPE_AGENT_ENS_NAME || 'planner.agentshawarma.eth';
const CODER_AGENT_ENS = process.env.CODER_AGENT_ENS_NAME || 'builder.agentshawarma.eth';

if (!USER_PRIVATE_KEY || !PAYMENT_AGENT_ADDRESS) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.bright}${colors.blue}[Step ${step}]${colors.reset} ${message}`);
}

// Create ENS client for Ethereum Mainnet
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// ENS resolution helper - uses Ethereum Mainnet for ENS
async function resolveENS(ensName, fallbackAddress) {
  try {
    const resolvedAddress = await ensClient.getEnsAddress({
      name: normalize(ensName),
    });
    if (resolvedAddress) {
      return { address: resolvedAddress, displayName: ensName };
    }
  } catch (error) {
    // Silently fall back
  }
  return { address: fallbackAddress, displayName: fallbackAddress };
}

// ABIs
const TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    name: 'depositForBurn',
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: 'message', type: 'bytes' }],
    name: 'MessageSent',
    type: 'event',
  },
];

const MESSAGE_TRANSMITTER_ABI = [
  {
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    name: 'receiveMessage',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const USDC_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
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
];

// Convert address to bytes32 format for CCTP
function addressToBytes32(address) {
  return '0x000000000000000000000000' + address.slice(2).toLowerCase();
}

// Wait for attestation from Circle
async function waitForAttestation(messageHash, maxAttempts = 30, delayMs = 5000) {
  log('⏳ Waiting for Circle attestation...', colors.yellow);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${IRIS_API_URL}/${messageHash}`);
      
      if (response.data && response.data.status === 'complete' && response.data.attestation) {
        log('✅ Attestation received!', colors.green);
        return response.data.attestation.replace(/^0x/, '');
      }
    } catch (error) {
      // 404 is expected while attestation is pending
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error('Attestation timeout');
}

// Check balances
async function checkBalances() {
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(),
  });

  const addresses = {
    'Payment Agent': { address: PAYMENT_AGENT_ADDRESS, ens: PAYMENT_AGENT_ENS },
    'Scope Agent': { address: SCOPE_AGENT_ADDRESS, ens: SCOPE_AGENT_ENS },
    'Coder Agent': { address: CODER_AGENT_ADDRESS, ens: CODER_AGENT_ENS },
  };

  log('\n💰 Current USDC Balances:', colors.yellow);
  
  for (const [name, info] of Object.entries(addresses)) {
    // Resolve ENS using Ethereum Sepolia
    const resolved = await resolveENS(info.ens, info.address);
    
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS_ARB_SEPOLIA,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [info.address],
    });
    
    const balanceInUsdc = Number(balance) / 1e6;
    log(`  ${name} (${resolved.displayName}): ${balanceInUsdc} USDC`, colors.cyan);
  }
}

// Main flow
async function main() {
  log('\n🚀 Seamless Payment Demo', colors.bright + colors.magenta);
  log('========================\n', colors.magenta);

  // Step 1: Verify Payment Agent is running
  logStep('1', 'Verifying Payment Agent...');
  try {
    const response = await axios.get(PAYMENT_AGENT_URL);
    if (response.data && response.data.name === 'Payment Agent') {
      log(`✅ Payment Agent is running: ${response.data.name} v${response.data.version}`, colors.green);
    }
  } catch (error) {
    log('❌ Payment Agent not accessible. Please start it with: pnpm dev', colors.red);
    process.exit(1);
  }

  // Check initial balances
  await checkBalances();

  // Step 2: Create payment request (starts listener)
  logStep('2', 'Creating payment request and starting listener...');
  
  let mcpClient;
  try {
    const transport = new SSEClientTransport(new URL(PAYMENT_AGENT_SSE));
    mcpClient = new Client(
      { name: 'seamless-demo-client', version: '1.0.0' },
      { capabilities: { streaming: false } }
    );
    
    await mcpClient.connect(transport);
    log('✅ Connected to Payment Agent MCP server', colors.green);
    
    // Call payment-processing tool to start listener
    const paymentResult = await mcpClient.callTool({
      name: 'payment-processing',
      arguments: {
        amount: PAYMENT_AMOUNT,
        payerAddress: USER_WALLET_ADDRESS,
        splitPercentage: SPLIT_PERCENTAGE,
      },
    });
    
    // Parse and display the payment URL and details
    if (paymentResult && paymentResult.content) {
      try {
        // Extract the deeply nested result
        let resultText = '';
        if (paymentResult.content[0]?.resource?.text) {
          // Parse the outer JSON
          const outerData = JSON.parse(paymentResult.content[0].resource.text);
          // Extract the inner text from the message
          if (outerData.status?.message?.parts?.[0]?.text) {
            resultText = outerData.status.message.parts[0].text;
          }
        }
        
        if (!resultText) {
          throw new Error('Could not extract result text');
        }
        
        const result = JSON.parse(resultText);
        
        if (result.paymentUrl) {
          log(`\n💳 Payment URL: ${result.paymentUrl}`, colors.bright + colors.cyan);
        }
        
        if (result.paymentDetails) {
          const details = result.paymentDetails;
          log('\n📋 Payment Details:', colors.yellow);
          log(`   Recipient: ${details.recipientENS}`, colors.cyan);
          log(`   Amount: ${details.amount} USDC`, colors.cyan);
          log(`   Split: ${details.splitPercentage}% to ${details.scopeAgent.ens}, ${100 - details.splitPercentage}% to ${details.coderAgent.ens}`, colors.cyan);
        }
      } catch (e) {
        // Fallback to generic message if parsing fails
        log('✅ Payment listener started', colors.green);
      }
    }
    
    log('\n✅ Payment listener active (2.5 minute timeout)', colors.green);
    log(`   Watching for ${PAYMENT_AMOUNT} USDC mint to ${PAYMENT_AGENT_ENS}`, colors.cyan);
    
  } catch (error) {
    log(`❌ Failed to start payment listener: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
  }

  // Add a small delay to ensure the listener is fully ready
  log('\n⏳ Waiting 3 seconds for listener to initialize...', colors.yellow);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 3: Execute CCTP transfer
  logStep('3', 'Executing CCTP transfer...');
  
  const account = privateKeyToAccount(`0x${USER_PRIVATE_KEY.replace(/^0x/, '')}`);
  
  // Create clients for both chains
  const ethWalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  const ethPublicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const arbWalletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(),
  });

  const arbPublicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(),
  });

  // Check Ethereum Sepolia balance
  const ethBalance = await ethPublicClient.readContract({
    address: USDC_ADDRESS_ETH_SEPOLIA,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  const ethBalanceInUsdc = Number(ethBalance) / 1e6;
  log(`\n📊 USDC Balance on Ethereum Sepolia: ${ethBalanceInUsdc} USDC`, colors.yellow);

  if (ethBalanceInUsdc < parseFloat(PAYMENT_AMOUNT)) {
    log('❌ Insufficient USDC on Ethereum Sepolia', colors.red);
    log('Get testnet USDC from: https://faucet.circle.com/', colors.yellow);
    process.exit(1);
  }

  const amountInUnits = parseUnits(PAYMENT_AMOUNT, 6);

  try {
    // Approve
    log('\n  📝 Approving USDC...', colors.cyan);
    const approveTx = await ethWalletClient.writeContract({
      address: USDC_ADDRESS_ETH_SEPOLIA,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [TOKEN_MESSENGER_ETH_SEPOLIA, amountInUnits],
    });
    await ethPublicClient.waitForTransactionReceipt({ hash: approveTx });
    log('  ✅ Approved', colors.green);

    // Burn
    log('  🔥 Burning USDC on Ethereum Sepolia...', colors.cyan);
    const mintRecipientBytes32 = addressToBytes32(PAYMENT_AGENT_ADDRESS);
    
    const burnTx = await ethWalletClient.writeContract({
      address: TOKEN_MESSENGER_ETH_SEPOLIA,
      abi: TOKEN_MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [
        amountInUnits,
        DESTINATION_DOMAIN,
        mintRecipientBytes32,
        USDC_ADDRESS_ETH_SEPOLIA,
      ],
    });
    
    const burnReceipt = await ethPublicClient.waitForTransactionReceipt({ hash: burnTx });
    log(`  ✅ Burned: ${burnTx}`, colors.green);
    
    // Extract message for attestation
    const logs = parseEventLogs({
      abi: TOKEN_MESSENGER_ABI,
      logs: burnReceipt.logs,
      eventName: 'MessageSent',
    });
    
    const messageBytes = logs[0].args.message;
    const { keccak256 } = await import('viem');
    const messageHash = keccak256(messageBytes);
    
    // Get attestation
    log('  ⏳ Getting attestation...', colors.cyan);
    const attestation = await waitForAttestation(messageHash);
    
    // Mint
    log('  💎 Minting on Arbitrum Sepolia...', colors.cyan);
    const mintTx = await arbWalletClient.writeContract({
      address: MESSAGE_TRANSMITTER_ARB_SEPOLIA,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [messageBytes, `0x${attestation}`],
    });
    
    await arbPublicClient.waitForTransactionReceipt({ hash: mintTx });
    log(`  ✅ Minted: ${mintTx}`, colors.green);
    
  } catch (error) {
    log(`❌ CCTP transfer failed: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Step 4: Monitor for distribution
  logStep('4', 'Monitoring for automatic distribution...');
  log('The Payment Agent should now detect the mint and distribute funds', colors.yellow);
  log('Check the Payment Agent console for:', colors.cyan);
  log('  - [PaymentListener] CCTP mint detected!', colors.cyan);
  log('  - Distribution transaction details', colors.cyan);
  
  // Wait a bit then check final balances
  log('\n⏳ Waiting 10 seconds for distribution...', colors.yellow);
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check final balances
  log('\n📊 Final Balance Check:', colors.bright + colors.yellow);
  await checkBalances();
  
  // Check for MintAndWithdraw event
  const currentBlock = await arbPublicClient.getBlockNumber();
  const MINT_EVENT = parseAbiItem(
    'event MintAndWithdraw(address indexed mintRecipient, uint256 amount, address indexed mintToken)'
  );
  
  const mintLogs = await arbPublicClient.getLogs({
    address: TOKEN_MESSENGER_ARB_SEPOLIA,
    event: MINT_EVENT,
    fromBlock: currentBlock - 50n,
    toBlock: currentBlock,
    args: {
      mintRecipient: PAYMENT_AGENT_ADDRESS,
    },
  });
  
  if (mintLogs.length > 0) {
    log('\n✅ MintAndWithdraw event confirmed!', colors.green);
    log(`   Block: ${mintLogs[0].blockNumber}`, colors.cyan);
    log(`   Amount: ${Number(mintLogs[0].args.amount) / 1e6} USDC`, colors.cyan);
    log(`   Recipient: ${PAYMENT_AGENT_ENS}`, colors.cyan);
  }
  
  log('\n✨ Demo complete!', colors.bright + colors.green);
  log('Check the Payment Agent console for distribution logs.', colors.yellow);
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.bright + colors.red);
  console.error(error);
  process.exit(1);
}); 