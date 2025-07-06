#!/usr/bin/env python3
"""
Seamless Payment Demo Script - Python Version with Official MCP SDK
Complete implementation matching the TypeScript demo:
1. Verifies Payment Agent is running
2. Creates payment request via MCP (starts listener)
3. Executes CCTP transfer (using web3.py)
4. Monitors for automatic distribution

The MCPClient class using the official SDK is modular and can be reused.
"""

import asyncio
import json
import os
import sys
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from decimal import Decimal
from eth_utils import to_checksum_address, keccak
from contextlib import AsyncExitStack

import aiohttp
from web3 import Web3
from web3.types import TxReceipt
from dotenv import load_dotenv

# MCP Official SDK imports
from mcp import ClientSession
from mcp.client.sse import sse_client

import eth_abi


# ===== REUSABLE MCP CLIENT MODULE - START =====
# You can copy this section to use in other projects

@dataclass
class MCPServerInfo:
    """Information about an MCP server"""
    name: str
    version: str
    protocol_version: str


@dataclass
class MCPToolInfo:
    """Information about an available MCP tool"""
    name: str
    description: str
    input_schema: Dict[str, Any]


class MCPOfficialClient:
    """
    MCP Client using the official Python SDK with SSE transport.
    This is a reusable, modular client for any MCP server.
    
    Usage:
        async with MCPOfficialClient() as client:
            await client.connect_to_sse_server("http://localhost:3002/sse")
            result = await client.call_tool("tool-name", {"arg": "value"})
    """
    
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self._exit_stack = None
        self._read_stream = None
        self._write_stream = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
    
    async def connect_to_sse_server(self, server_url: str):
        """Connect to an MCP server via SSE"""
        # Connect via SSE using the official SDK
        self._exit_stack = AsyncExitStack()
        await self._exit_stack.__aenter__()
        
        # Enter the sse_client context manager properly
        transport = await self._exit_stack.enter_async_context(sse_client(url=server_url))
        self._read_stream, self._write_stream = transport
        
        # Initialize the session
        self.session = await self._exit_stack.enter_async_context(
            ClientSession(self._read_stream, self._write_stream)
        )
        
        # Initialize the connection
        result = await self.session.initialize()
        
        print(f"✅ Connected to server: {result.serverInfo.name} v{result.serverInfo.version}")
    
    async def get_server_info(self) -> MCPServerInfo:
        """Get information about the connected MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to a server")
        
        result = await self.session.initialize()
        
        return MCPServerInfo(
            name=result.serverInfo.name,
            version=result.serverInfo.version,
            protocol_version=result.protocolVersion
        )
    
    async def list_tools(self) -> List[MCPToolInfo]:
        """List available tools from the MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to a server")
        
        result = await self.session.list_tools()
        
        return [
            MCPToolInfo(
                name=tool.name,
                description=tool.description or "",
                input_schema=tool.inputSchema
            )
            for tool in result.tools
        ]
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool on the MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to a server")
        
        result = await self.session.call_tool(tool_name, arguments)
        
        # Extract content from result
        if hasattr(result, 'content') and result.content:
            content_list = []
            for content_item in result.content:
                if hasattr(content_item, 'text'):
                    content_list.append(content_item.text)
                elif hasattr(content_item, 'resource'):
                    # Handle vibekit resource format
                    content_list.append(content_item.resource)
            
            return content_list[0] if len(content_list) == 1 else content_list
        
        return result
    
    async def cleanup(self):
        """Clean up resources"""
        if hasattr(self, '_exit_stack') and self._exit_stack:
            await self._exit_stack.__aexit__(None, None, None)

# ===== REUSABLE MCP CLIENT MODULE - END =====


# Demo-specific configuration and constants
load_dotenv('payment-agent/.env')

# Configuration
PAYMENT_AGENT_URL = 'http://localhost:3002'
PAYMENT_AGENT_SSE = 'http://localhost:3002/sse'
PAYMENT_AMOUNT = '1'  # 1 USDC
SPLIT_PERCENTAGE = 60  # 60% to Scope Agent, 40% to Coder Agent

# CCTP Configuration
USDC_ADDRESS_ETH_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
USDC_ADDRESS_ARB_SEPOLIA = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
TOKEN_MESSENGER_ETH_SEPOLIA = '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5'
TOKEN_MESSENGER_ARB_SEPOLIA = '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa'
MESSAGE_TRANSMITTER_ARB_SEPOLIA = '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872'
DESTINATION_DOMAIN = 3  # Arbitrum domain ID for CCTP
IRIS_API_URL = 'https://iris-api-sandbox.circle.com/v1/attestations'

# Get configuration from environment
USER_PRIVATE_KEY = os.getenv('USER_WALLET_PRIVATE_KEY')
USER_WALLET_ADDRESS = os.getenv('USER_WALLET_ADDRESS')
PAYMENT_AGENT_ADDRESS = os.getenv('PAYMENT_AGENT_ADDRESS')
SCOPE_AGENT_ADDRESS = os.getenv('SCOPE_AGENT_ADDRESS')
CODER_AGENT_ADDRESS = os.getenv('CODER_AGENT_ADDRESS')

# ENS names
PAYMENT_AGENT_ENS = os.getenv('PAYMENT_AGENT_ENS_NAME', 'payments.agentshawarma.eth')
SCOPE_AGENT_ENS = os.getenv('SCOPE_AGENT_ENS_NAME', 'planner.agentshawarma.eth')
CODER_AGENT_ENS = os.getenv('CODER_AGENT_ENS_NAME', 'builder.agentshawarma.eth')

# ABIs (minimal versions for the functions we need)
USDC_ABI = [
    {
        "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

TOKEN_MESSENGER_ABI = [
    {
        "inputs": [
            {"name": "amount", "type": "uint256"},
            {"name": "destinationDomain", "type": "uint32"},
            {"name": "mintRecipient", "type": "bytes32"},
            {"name": "burnToken", "type": "address"}
        ],
        "name": "depositForBurn",
        "outputs": [{"name": "nonce", "type": "uint64"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [{"indexed": False, "name": "message", "type": "bytes"}],
        "name": "MessageSent",
        "type": "event"
    }
]

MESSAGE_TRANSMITTER_ABI = [
    {
        "inputs": [
            {"name": "message", "type": "bytes"},
            {"name": "attestation", "type": "bytes"}
        ],
        "name": "receiveMessage",
        "outputs": [{"name": "success", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]


def address_to_bytes32(address: str) -> str:
    """Convert address to bytes32 format for CCTP"""
    return '0x000000000000000000000000' + address[2:].lower()


async def wait_for_attestation(message_hash: str, max_attempts: int = 30, delay_ms: int = 5000) -> str:
    """Wait for attestation from Circle"""
    print('⏳ Waiting for Circle attestation...')
    print(f'   Message hash: {message_hash}')
    print(f'   Max wait time: {(max_attempts * delay_ms) / 1000} seconds')
    
    async with aiohttp.ClientSession() as session:
        for attempt in range(1, max_attempts + 1):
            try:
                url = f"{IRIS_API_URL}/{message_hash}"
                print(f'\n   Attempt {attempt}/{max_attempts}: Checking {url}')
                
                async with session.get(url) as response:
                    print(f'   Response status: {response.status}')
                    
                    if response.status == 200:
                        data = await response.json()
                        print(f'   Response data: {json.dumps(data, indent=2)}')
                        
                        if data.get('status') == 'complete' and data.get('attestation'):
                            print('✅ Attestation received!')
                            return data['attestation'].replace('0x', '')
                        else:
                            print(f'   Status: {data.get("status", "unknown")}')
                    elif response.status == 404:
                        print('   Attestation not found yet')
                    else:
                        text = await response.text()
                        print(f'   Unexpected response: {text}')
            except Exception as e:
                print(f'   Error: {e}')
            
            if attempt < max_attempts:
                print(f'   Waiting {delay_ms/1000} seconds before retry...')
                await asyncio.sleep(delay_ms / 1000)
    
    print(f'\n❌ Timeout after {max_attempts} attempts')
    print(f'   You can manually check: {IRIS_API_URL}/{message_hash}')
    raise Exception('Attestation timeout')


async def check_balances(w3_arb: Web3):
    """Check USDC balances on Arbitrum Sepolia"""
    addresses = {
        'Payment Agent': {'address': PAYMENT_AGENT_ADDRESS, 'ens': PAYMENT_AGENT_ENS},
        'Scope Agent': {'address': SCOPE_AGENT_ADDRESS, 'ens': SCOPE_AGENT_ENS},
        'Coder Agent': {'address': CODER_AGENT_ADDRESS, 'ens': CODER_AGENT_ENS},
    }
    
    print('\n💰 Current USDC Balances on Arbitrum Sepolia:')
    
    usdc_contract = w3_arb.eth.contract(address=USDC_ADDRESS_ARB_SEPOLIA, abi=USDC_ABI)
    
    for name, info in addresses.items():
        balance = usdc_contract.functions.balanceOf(info['address']).call()
        balance_in_usdc = balance / 10**6
        print(f"  {name} ({info['ens']}): {balance_in_usdc} USDC")


async def execute_cctp_transfer(w3_eth: Web3, w3_arb: Web3, amount_usdc: str) -> bool:
    """Execute the CCTP transfer from Ethereum Sepolia to Arbitrum Sepolia"""
    print('\n[Step 3] Executing CCTP transfer...')
    
    if not USER_PRIVATE_KEY:
        print('❌ Missing USER_WALLET_PRIVATE_KEY environment variable')
        print('ℹ️  For demo purposes, you can test without executing the transfer')
        print('   The Payment Agent will timeout after 2.5 minutes')
        return False
    
    # Import account from private key
    from eth_account import Account
    # Handle private key with or without 0x prefix
    private_key = USER_PRIVATE_KEY if USER_PRIVATE_KEY.startswith('0x') else f'0x{USER_PRIVATE_KEY}'
    account = Account.from_key(private_key)
    
    # Check Ethereum Sepolia balance
    usdc_eth = w3_eth.eth.contract(address=USDC_ADDRESS_ETH_SEPOLIA, abi=USDC_ABI)
    eth_balance = usdc_eth.functions.balanceOf(account.address).call()
    eth_balance_usdc = eth_balance / 10**6
    
    print(f'\n📊 USDC Balance on Ethereum Sepolia: {eth_balance_usdc} USDC')
    
    if eth_balance_usdc < float(amount_usdc):
        print('❌ Insufficient USDC on Ethereum Sepolia')
        print('Get testnet USDC from: https://faucet.circle.com/')
        return False
    
    amount_units = int(float(amount_usdc) * 10**6)  # Convert to 6 decimal places
    
    try:
        # 1. Approve USDC
        print('\n  📝 Approving USDC...')
        
        # Get pending nonce to handle any stuck transactions
        pending_nonce = w3_eth.eth.get_transaction_count(account.address, 'pending')
        latest_nonce = w3_eth.eth.get_transaction_count(account.address, 'latest')
        nonce = max(pending_nonce, latest_nonce)
        
        # Get gas price with 10% increase to ensure transaction goes through
        base_gas_price = w3_eth.eth.gas_price
        gas_price = int(base_gas_price * 1.1)
        
        approve_tx = usdc_eth.functions.approve(
            TOKEN_MESSENGER_ETH_SEPOLIA, 
            amount_units
        ).build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 100000,
            'gasPrice': gas_price,
        })
        
        signed_approve = account.sign_transaction(approve_tx)
        # Handle both old and new web3.py versions
        raw_tx = signed_approve.rawTransaction if hasattr(signed_approve, 'rawTransaction') else signed_approve.raw_transaction
        approve_hash = w3_eth.eth.send_raw_transaction(raw_tx)
        approve_receipt = w3_eth.eth.wait_for_transaction_receipt(approve_hash)
        print('  ✅ Approved')
        
        # 2. Burn USDC on Ethereum
        print('  🔥 Burning USDC on Ethereum Sepolia...')
        mint_recipient_bytes32 = address_to_bytes32(PAYMENT_AGENT_ADDRESS)
        
        # Get fresh nonce after approve transaction
        pending_nonce = w3_eth.eth.get_transaction_count(account.address, 'pending')
        latest_nonce = w3_eth.eth.get_transaction_count(account.address, 'latest')
        current_nonce = max(pending_nonce, latest_nonce)
        
        token_messenger = w3_eth.eth.contract(address=TOKEN_MESSENGER_ETH_SEPOLIA, abi=TOKEN_MESSENGER_ABI)
        burn_tx = token_messenger.functions.depositForBurn(
            amount_units,
            DESTINATION_DOMAIN,
            mint_recipient_bytes32,
            USDC_ADDRESS_ETH_SEPOLIA
        ).build_transaction({
            'from': account.address,
            'nonce': current_nonce,
            'gas': 300000,
            'gasPrice': gas_price,  # Use same gas price as approve
        })
        
        signed_burn = account.sign_transaction(burn_tx)
        raw_tx = signed_burn.rawTransaction if hasattr(signed_burn, 'rawTransaction') else signed_burn.raw_transaction
        burn_hash = w3_eth.eth.send_raw_transaction(raw_tx)
        burn_receipt = w3_eth.eth.wait_for_transaction_receipt(burn_hash)
        print(f'  ✅ Burned: {burn_hash.hex()}')
        
        # 3. Extract message for attestation
        print('  📋 Extracting message from burn receipt...')
        
        # Use Web3's ABI decoder for the MessageSent event instead of manual parsing
        message_events = token_messenger.events.MessageSent().processReceipt(burn_receipt)

        if not message_events:
            raise Exception('MessageSent event not found')

        message_bytes = message_events[0]['args']['message']  # Already bytes
        message_hex = '0x' + message_bytes.hex()
        print('  📝 Message extracted from event')
        
        # Calculate the hash - use bytes directly
        try:
            message_hash = w3_eth.keccak(message_bytes)
            print(f'     Message hash: {message_hash.hex()}')
        except Exception as e:
            print(f'     ❌ Error calculating hash: {e}')
            raise
        
        # 4. Get attestation
        print('  ⏳ Getting attestation...')
        attestation = await wait_for_attestation(message_hash.hex())
        
        # 5. Mint on Arbitrum
        print('  💎 Minting on Arbitrum Sepolia...')
        message_transmitter = w3_arb.eth.contract(
            address=MESSAGE_TRANSMITTER_ARB_SEPOLIA, 
            abi=MESSAGE_TRANSMITTER_ABI
        )
        
        # Get proper nonce and gas price for Arbitrum
        arb_pending_nonce = w3_arb.eth.get_transaction_count(account.address, 'pending')
        arb_latest_nonce = w3_arb.eth.get_transaction_count(account.address, 'latest')
        arb_nonce = max(arb_pending_nonce, arb_latest_nonce)
        arb_gas_price = int(w3_arb.eth.gas_price * 1.1)
        
        mint_tx = message_transmitter.functions.receiveMessage(
            message_bytes,
            bytes.fromhex(attestation)
        ).build_transaction({
            'from': account.address,
            'nonce': arb_nonce,
            'gas': 300000,
            'gasPrice': arb_gas_price,
        })
        
        signed_mint = account.sign_transaction(mint_tx)
        raw_tx = signed_mint.rawTransaction if hasattr(signed_mint, 'rawTransaction') else signed_mint.raw_transaction
        mint_hash = w3_arb.eth.send_raw_transaction(raw_tx)
        mint_receipt = w3_arb.eth.wait_for_transaction_receipt(mint_hash)
        print(f'  ✅ Minted: {mint_hash.hex()}')
        
        return True
        
    except Exception as e:
        print(f'❌ CCTP transfer failed: {e}')
        return False


async def main():
    """Main demo flow"""
    print('\n🚀 Seamless Payment Demo - Python with Official MCP SDK')
    print('======================================================\n')
    
    if not PAYMENT_AGENT_ADDRESS:
        print('❌ Missing required environment variables')
        sys.exit(1)
    
    # Initialize Web3 connections with proper RPC endpoints
    # You can get free RPC endpoints from: https://www.infura.io/ or https://www.alchemy.com/
    ETH_RPC = os.getenv('ETH_SEPOLIA_RPC', 'https://rpc.ankr.com/eth_sepolia')
    ARB_RPC = os.getenv('ARB_SEPOLIA_RPC', 'https://sepolia-rollup.arbitrum.io/rpc')
    
    w3_eth = None
    w3_arb = None
    
    # Only try to connect if we have a private key for transfers
    if USER_PRIVATE_KEY:
        try:
            w3_eth = Web3(Web3.HTTPProvider(ETH_RPC))
            w3_arb = Web3(Web3.HTTPProvider(ARB_RPC))
            
            if not w3_eth.is_connected() or not w3_arb.is_connected():
                print('⚠️  Warning: Failed to connect to blockchain RPCs')
                print('ℹ️  CCTP transfer will be skipped')
                print('   For full demo, set ETH_SEPOLIA_RPC and ARB_SEPOLIA_RPC environment variables')
                w3_eth = None
                w3_arb = None
        except Exception as e:
            print(f'⚠️  Warning: Blockchain connection failed: {e}')
            print('   CCTP transfer will be skipped')
            w3_eth = None
            w3_arb = None
    else:
        print('ℹ️  No private key provided - running in demo mode without CCTP transfer')
    
    # Step 1: Verify Payment Agent is running
    print('[Step 1] Verifying Payment Agent...')
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(PAYMENT_AGENT_URL) as response:
                data = await response.json()
                if data.get('name') == 'Payment Agent':
                    print(f"✅ Payment Agent is running: {data['name']} v{data['version']}")
    except:
        print('❌ Payment Agent not accessible. Please start it with: pnpm dev')
        sys.exit(1)
    
    # Check initial balances
    if w3_arb:
        await check_balances(w3_arb)
    
    # Step 2: Create payment request (starts listener)
    print('\n[Step 2] Creating payment request and starting listener...')
    
    async with MCPOfficialClient() as client:
        try:
            await client.connect_to_sse_server(PAYMENT_AGENT_SSE)
            
            # Call payment-processing tool
            result = await client.call_tool("payment-processing", {
                "amount": PAYMENT_AMOUNT,
                "payerAddress": USER_WALLET_ADDRESS or "0x0000000000000000000000000000000000000000",
                "splitPercentage": SPLIT_PERCENTAGE,
            })
            
            # Parse and display result
            if result:
                try:
                    # Handle the nested result format
                    if isinstance(result, dict) and 'text' in result:
                        outer_data = json.loads(result['text'])
                        if outer_data.get('status', {}).get('message', {}).get('parts', [{}])[0].get('text'):
                            result_text = outer_data['status']['message']['parts'][0]['text']
                            payment_data = json.loads(result_text)
                            
                            if payment_data.get('paymentUrl'):
                                print(f"\n💳 Payment URL: {payment_data['paymentUrl']}")
                            
                            if payment_data.get('paymentDetails'):
                                details = payment_data['paymentDetails']
                                print('\n📋 Payment Details:')
                                print(f"   Recipient: {details['recipientENS']}")
                                print(f"   Amount: {details['amount']} USDC")
                                print(f"   Split: {details['splitPercentage']}% to {details['scopeAgent']['ens']}")
                                print(f"         {100 - details['splitPercentage']}% to {details['coderAgent']['ens']}")
                except:
                    print('✅ Payment listener started')
            
            print(f'\n✅ Payment listener active (2.5 minute timeout)')
            print(f'   Watching for {PAYMENT_AMOUNT} USDC mint to {PAYMENT_AGENT_ENS}')
            
        except Exception as e:
            print(f'❌ Failed to start payment listener: {e}')
            sys.exit(1)
    
    # Wait for listener to initialize
    print('\n⏳ Waiting 3 seconds for listener to initialize...')
    await asyncio.sleep(3)
    
    # Step 3: Execute CCTP transfer    
    if USER_PRIVATE_KEY and w3_eth and w3_arb:
        success = await execute_cctp_transfer(w3_eth, w3_arb, PAYMENT_AMOUNT)
        if success:
            # Step 4: Monitor for distribution
            print('\n[Step 4] Monitoring for automatic distribution...')
            print('The Payment Agent should now detect the mint and distribute funds')
            print('Check the Payment Agent console for:')
            print('  - [PaymentListener] CCTP mint detected!')
            print('  - Distribution transaction details')
            
            # Wait and check final balances
            print('\n⏳ Waiting 10 seconds for distribution...')
            await asyncio.sleep(10)
            
            if w3_arb:
                print('\n📊 Final Balance Check:')
                await check_balances(w3_arb)
    else:
        print('\n[Step 3] Skipping CCTP transfer (no private key provided)')
        print('ℹ️  To execute the full demo, set USER_WALLET_PRIVATE_KEY in the environment')
        print('   Get testnet USDC from: https://faucet.circle.com/')
    
    print('\n✨ Demo complete!')
    print('\n📝 To use the MCP client in your own code:')
    print('   1. Copy the MCPOfficialClient class')
    print('   2. Install: pip install mcp')
    print('   3. Use as shown in this demo')


if __name__ == "__main__":
    asyncio.run(main()) 