# Multi-Agent Payment Workflow Demo

This hackathon project demonstrates an automated payment distribution system using three Vibekit agents and Circle's Cross-Chain Transfer Protocol (CCTP).

## Architecture

- **Payment Agent**: Receives USDC payments and automatically distributes them
- **Scope Agent**: Receives a percentage of payments for project scoping work
- **Coder Agent**: Receives the remainder for implementation work

## Key Features

- 🚀 Cross-chain USDC payments via CCTP
- ⚡ 1-second payment detection latency
- 🤖 Automatic fund distribution
- 💰 Configurable split percentages
- 🔌 Real MCP (Model Context Protocol) integration

## Running the Demo

### Prerequisites
1. Node.js 22+ and pnpm installed
2. Test wallet with USDC on Arbitrum Sepolia
3. Environment variables configured (optional)

### Quick Start

```bash
# From repository root
pnpm install
pnpm build

# Start the Payment Agent (in one terminal)
cd agents/payment-agent
pnpm dev

# Run the unified demo script (in another terminal)
cd agents
node run-payment-demo.js
```

### What the Demo Does

The `run-payment-demo.js` script provides a complete end-to-end demonstration:

1. **System Verification** - Tests all components are working:
   - Payment Agent availability
   - MCP endpoints accessibility
   - Blockchain RPC connection
   - USDC contract verification
   - Event monitoring capability

2. **Payment Request Creation** - Uses real MCP protocol to:
   - Connect to the Payment Agent's SSE endpoint
   - Call the payment-processing tool
   - Generate transaction data for your payment

3. **Transaction Details** - Displays:
   - Complete transaction data for sending USDC
   - Payment split calculations
   - Agent wallet addresses

4. **Execution Instructions** - Guides you to:
   - Send USDC using the provided transaction data
   - Monitor the Payment Agent for automatic distribution

### Demo Flow

1. The script will prompt you for a test wallet address (or use default)
2. It creates a payment request for 1 USDC with a 60/40 split
3. You receive transaction data to send USDC to the Payment Agent
4. The Payment Agent detects the payment and automatically distributes:
   - 60% (0.6 USDC) to the Scope Agent
   - 40% (0.4 USDC) to the Coder Agent

### Configuration

The demo uses these default values:
- Payment Amount: 1 USDC
- Split: 60% to Scope Agent, 40% to Coder Agent
- Chain: Arbitrum Sepolia

You can modify these in the `run-payment-demo.js` script.

### Wallet Addresses

Default agent addresses (can be overridden with environment variables):
- Payment Agent: `0xDd418eC7d4AfF6d199ACd537e962664f34c9F7c7`
- Scope Agent: `0x3F9032f96A64F3396FdFEEEe3f26B798B1a11b65`
- Coder Agent: `0x3BE92Fe06409096711087280CD6661854Ca4724E`

### Troubleshooting

If the demo fails:
1. Ensure the Payment Agent is running (`cd agents/payment-agent && pnpm dev`)
2. Check you have internet connection for RPC calls
3. Verify the Payment Agent is accessible at `http://localhost:3002`
4. Check the Payment Agent console for error messages

### Additional Scripts

- `generate-wallets.js` - Generates new EOA wallets for all agents (if needed)

## Technical Details

This demo showcases:
- Arbitrum Vibekit agent framework
- MCP (Model Context Protocol) for agent communication
- Circle's CCTP for cross-chain USDC transfers
- Automated on-chain event monitoring
- Smart contract interactions via viem