# How Test Scripts Interact with the Payment Agent

## Overview

The test scripts have different levels of interaction with the actual Payment Agent we built:

## Test Script Types & Agent Interaction

### 1. Infrastructure Tests (`test-payment-agent.js`)
**Agent Interaction: HTTP Only**
- ✅ Connects to the running Payment Agent's HTTP server
- ✅ Verifies MCP endpoints are accessible
- ❌ Does NOT invoke MCP tools or trigger agent logic
- ❌ Does NOT test the payment detection/distribution code

**What it tests:**
- Agent is running on port 3002
- HTTP endpoints respond correctly
- Can connect to blockchain RPC

### 2. Demo Scripts (Limited Interaction)

#### `demo-payment-flow-interactive.js`
**Agent Interaction: HTTP Only**
- ✅ Connects to Payment Agent HTTP server
- ✅ Shows what transaction data would look like
- ❌ Does NOT actually invoke the MCP tool
- ❌ Does NOT trigger payment detection

#### `send-payment-demo.js` (Same-Chain)
**Agent Interaction: NONE**
- ❌ Sends USDC directly on-chain (bypasses agent)
- ❌ Won't trigger MintAndWithdraw event detection
- ❌ Agent's listener won't activate

#### `send-cctp-payment-demo.js` (Cross-Chain) ⭐
**Agent Interaction: AUTOMATIC**
- ✅ Sends real CCTP cross-chain transfer
- ✅ WILL trigger the Payment Agent's event listener
- ✅ Agent will automatically detect and distribute funds
- ✅ Full end-to-end test of agent functionality

### 3. Integration Test (`integration-test.js`)
**Agent Interaction: Attempted MCP**
- ⚠️ Tries to connect via MCP protocol
- ❌ Has compatibility issues with SSE transport
- ❌ Cannot successfully invoke tools

## How the Payment Agent Works

```
1. Agent starts → Registers MCP tool "payment-processing"
2. User calls tool → Returns transaction data + starts listener
3. Listener polls every 1 second for MintAndWithdraw events
4. When CCTP mint detected → Auto-distributes to Scope/Coder
5. After 5 minutes → Listener times out
```

## Full Test Flow (with Running Agent)

### Prerequisites
```bash
# Terminal 1: Start all services from root
pnpm dev

# This starts:
# - Payment Agent on port 3002
# - CCTP web app on port 3000
# - Scope/Coder placeholder agents
```

### Test Scenarios

#### Scenario 1: Test Infrastructure Only
```bash
# Terminal 2: From /agents directory
node test-payment-agent.js
```
- Verifies agent is running
- No actual payment processing

#### Scenario 2: Full CCTP Cross-Chain Test
```bash
# Terminal 2: From /agents directory
node send-cctp-payment-demo.js
```

**What happens:**
1. Script burns USDC on Ethereum Sepolia
2. Waits for Circle attestation (~30-60s)
3. Completes transfer on Arbitrum Sepolia
4. **Payment Agent detects MintAndWithdraw event**
5. **Agent automatically distributes funds**

**Watch Terminal 1 for:**
```
[PaymentListener] Starting CCTP mint detection...
[PaymentListener] Checking for CCTP mints...
[PaymentListener] CCTP mint detected!
[PaymentListener] Recipient: 0xDd418eC7d4AfF6d199ACd537e962664f34c9F7c7
[PaymentListener] Amount: 10000000 (10.00 USDC)
[PaymentListener] Distributing funds...
[PaymentListener] Distribution complete!
```

#### Scenario 3: Use CCTP Web App
1. Open http://localhost:3000
2. Connect wallet
3. Send USDC from any supported chain to Payment Agent address
4. Agent will detect and auto-distribute

## Key Points

1. **The Payment Agent is a real MCP server** that runs independently
2. **Test scripts don't directly call agent code** - they interact via:
   - HTTP requests to verify it's running
   - On-chain transactions that trigger events
3. **Only CCTP cross-chain transfers trigger the agent** - not same-chain transfers
4. **The agent's listener is automatic** - once started, it polls for events
5. **Distribution happens on-chain** - agent signs and sends real transactions

## Why This Architecture?

- **Realistic**: Tests the actual deployed agent, not mocked code
- **Event-driven**: Agent responds to blockchain events, not API calls
- **Autonomous**: Agent makes decisions and executes transactions independently
- **Hackathon-ready**: Shows working multi-agent payment automation 