# Python MCP Demo Scripts

This directory contains Python implementations for interacting with MCP (Model Context Protocol) servers, specifically demonstrating payment processing capabilities with full blockchain integration.

## Available Scripts

### 1. `mcp_client_official_sse.py` - Core MCP Client
A modular implementation using the official MCP Python SDK with SSE (Server-Sent Events) transport. This script:
- Connects to the Payment Agent MCP server
- Lists available tools
- Creates payment requests
- Demonstrates the basic MCP client pattern

### 2. `seamless-payment-demo-official.py` - Full Payment Demo with CCTP
A complete end-to-end demo that includes:
- Payment Agent verification
- Payment request creation via MCP
- **Full CCTP (Cross-Chain Token Protocol) transfer execution:**
  - Approves USDC on Ethereum Sepolia
  - Burns USDC via `depositForBurn`
  - Waits for Circle attestation
  - Mints USDC on Arbitrum Sepolia
- Automatic distribution monitoring

## Prerequisites

- Python 3.8 or higher
- Payment Agent running on `http://localhost:3002`
- Test USDC on Ethereum Sepolia (get from https://faucet.circle.com/)
- Required environment variables for full demo

## Setup Instructions

1. **Create and activate a virtual environment:**
   ```bash
   cd agents
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Payment Agent (in a separate terminal):**
   ```bash
   cd payment-agent
   pnpm install
   pnpm dev
   ```

## Running the Scripts

### Basic MCP Client Demo
```bash
python mcp_client_official_sse.py
```

This will:
- Connect to the Payment Agent at `http://localhost:3002/sse`
- Display server information
- List available tools
- Create a sample payment request

### Full Payment Demo with CCTP Transfer
```bash
python seamless-payment-demo-official.py
```

This will:
- Verify the Payment Agent is running
- Check USDC balances on Arbitrum Sepolia
- Create a payment request with automatic distribution
- **Execute a real CCTP transfer from Ethereum to Arbitrum**
- Monitor for automatic fund distribution

## Environment Variables

For the full demo with blockchain integration, create a `.env` file or set these environment variables:

```env
# Required for CCTP transfers
USER_WALLET_PRIVATE_KEY=your_private_key_with_testnet_usdc
USER_WALLET_ADDRESS=your_wallet_address

# Agent addresses (defaults provided)
PAYMENT_AGENT_ADDRESS=0xDd418eC7d4AfF6d199ACd537e962664f34c9F7c7
SCOPE_AGENT_ADDRESS=0x3F9032f96A64F3396FdFEEEe3f26B798B1a11b65
CODER_AGENT_ADDRESS=0x3BE92Fe06409096711087280CD6661854Ca4724E

# Optional: Custom RPC endpoints (defaults to public endpoints)
ETH_SEPOLIA_RPC=https://your-ethereum-sepolia-rpc
ARB_SEPOLIA_RPC=https://your-arbitrum-sepolia-rpc
```

## Using the MCP Client in Your Project

The `MCPOfficialClient` class from either script can be copied and reused:

```python
from mcp_client import MCPOfficialClient

async def main():
    async with MCPOfficialClient() as client:
        await client.connect_to_sse_server("http://your-server/sse")
        
        # List tools
        tools = await client.list_tools()
        
        # Call a tool
        result = await client.call_tool("tool-name", {
            "param1": "value1",
            "param2": "value2"
        })
        
        print(result)

asyncio.run(main())
```

## Dependencies

- `mcp` - Official MCP Python SDK
- `aiohttp` - Async HTTP client
- `python-dotenv` - Environment variable management
- `web3` - Ethereum blockchain interaction
- `eth-utils` - Ethereum utilities
- `eth-account` - Ethereum account management and transaction signing

## Testing the Full Flow

1. **Get Test USDC**: Visit https://faucet.circle.com/ to get USDC on Ethereum Sepolia
2. **Set Private Key**: Export your wallet's private key (with test funds only!)
3. **Run the Demo**: Execute `python seamless-payment-demo-official.py`
4. **Watch the Magic**: The script will:
   - Create a payment request
   - Transfer USDC from Ethereum to Arbitrum
   - The Payment Agent will detect the mint and distribute funds automatically

## Troubleshooting

### Connection Refused
- Ensure the Payment Agent is running on port 3002
- Check firewall settings

### Module Not Found
- Activate the virtual environment
- Run `pip install -r requirements.txt`

### Insufficient USDC
- Visit https://faucet.circle.com/ to get test USDC on Ethereum Sepolia
- Make sure you're using the correct network (Ethereum Sepolia, not mainnet)

### RPC Connection Failed
- The demo uses public RPC endpoints by default
- For better reliability, get free RPC endpoints from:
  - https://www.infura.io/
  - https://www.alchemy.com/
  - https://www.quicknode.com/

### Transaction Failed
- Check your wallet has enough ETH for gas on both Ethereum and Arbitrum Sepolia
- Ensure the private key is correctly formatted (with or without 0x prefix)

## Security Notes

- **NEVER** use real private keys with actual funds
- This is for testnet demonstration only
- Always use environment variables for sensitive data
- The demo uses test networks (Sepolia) exclusively

## Notes

- The Payment Agent must be running before executing these scripts
- The scripts demonstrate both basic MCP usage and advanced blockchain integration
- CCTP transfers typically take 1-2 minutes for attestation
- The Payment Agent polls every second for incoming mints 