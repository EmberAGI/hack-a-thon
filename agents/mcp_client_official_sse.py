#!/usr/bin/env python3
"""
MCP Client using the official Python SDK with SSE transport
This client connects to the payment agent using the official MCP SDK.
"""

import asyncio
import json
from typing import Optional, List, Dict, Any
from contextlib import AsyncExitStack

from mcp import ClientSession
from mcp.client.sse import sse_client

from dataclasses import dataclass


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
    This client can connect to MCP servers that use SSE/HTTP transport.
    """
    
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
    
    async def __aenter__(self):
        await self.exit_stack.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
    
    async def connect_to_sse_server(self, server_url: str):
        """
        Connect to an MCP server via SSE
        
        Args:
            server_url: URL of the SSE endpoint (e.g., "http://localhost:3002/sse")
        """
        # Connect via SSE
        sse_transport = await self.exit_stack.enter_async_context(
            sse_client(url=server_url)
        )
        
        # The sse_client returns a tuple of (read_stream, write_stream)
        read_stream, write_stream = sse_transport
        
        # Initialize the session
        self.session = await self.exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
        
        # Initialize the connection
        result = await self.session.initialize()
        
        print(f"Connected to server: {result.serverInfo.name} v{result.serverInfo.version}")
        print(f"Protocol version: {result.protocolVersion}")
    
    async def get_server_info(self) -> MCPServerInfo:
        """Get information about the connected MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to a server")
        
        # Re-initialize to get server info (MCP pattern)
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
        """
        Call a tool on the MCP server
        
        Args:
            tool_name: Name of the tool to call
            arguments: Arguments to pass to the tool
            
        Returns:
            The result from the tool
        """
        if not self.session:
            raise RuntimeError("Not connected to a server")
        
        result = await self.session.call_tool(tool_name, arguments)
        
        # Extract the content from the result
        if hasattr(result, 'content') and result.content:
            # Handle different content types
            content_list = []
            for content_item in result.content:
                if hasattr(content_item, 'text'):
                    content_list.append(content_item.text)
                elif hasattr(content_item, 'data'):
                    content_list.append(content_item.data)
                elif hasattr(content_item, 'resource'):
                    # Handle resource content (vibekit specific)
                    content_list.append(content_item.resource)
            
            return content_list if len(content_list) > 1 else (content_list[0] if content_list else None)
        
        return result
    
    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()


# Example usage
async def main():
    """Example of using the official MCP SDK with SSE transport"""
    
    print("🔌 MCP Client using Official SDK with SSE Transport")
    print("="*60)
    
    # Connect to the Payment Agent
    async with MCPOfficialClient() as client:
        try:
            print("\n1️⃣ Connecting to Payment Agent...")
            await client.connect_to_sse_server("http://localhost:3002/sse")
            
            # Get server info
            print("\n2️⃣ Getting server information...")
            info = await client.get_server_info()
            print(f"   Server: {info.name} v{info.version}")
            print(f"   Protocol: {info.protocol_version}")
            
            # List available tools
            print("\n3️⃣ Listing available tools...")
            tools = await client.list_tools()
            print(f"   Found {len(tools)} tools:")
            for tool in tools:
                print(f"\n   • {tool.name}")
                print(f"     Description: {tool.description}")
                if tool.input_schema.get("properties"):
                    print("     Parameters:")
                    for param, schema in tool.input_schema["properties"].items():
                        required = param in tool.input_schema.get("required", [])
                        req_marker = "*" if required else ""
                        desc = schema.get('description', '')
                        print(f"       - {param}{req_marker}: {schema.get('type', 'any')} - {desc}")
            
            # Call the payment-processing tool
            print("\n\n4️⃣ Creating a payment request...")
            print("   This will start listening for USDC payments")
            
            result = await client.call_tool("payment-processing", {
                "amount": "1",
                "payerAddress": "0x2D2c313EC7650995B193a34E16bE5B86eEdE872d",
                "splitPercentage": 60
            })
            
            print(f"\n📤 Tool result:")
            
            # The result is a TextResourceContents object
            if hasattr(result, 'text') and result.text:
                try:
                    # Parse the task JSON
                    task_data = json.loads(result.text)
                    if 'status' in task_data and 'message' in task_data['status']:
                        message = task_data['status']['message']
                        if 'parts' in message:
                            for part in message['parts']:
                                if part.get('kind') == 'text' and 'text' in part:
                                    # Parse the actual payment result
                                    payment_result = json.loads(part['text'])
                                    print("\n✨ Payment request created successfully!")
                                    print(json.dumps(payment_result, indent=2))
                                    
                                    # Extract key information
                                    if payment_result.get('success'):
                                        print(f"\n💳 Payment URL: {payment_result['paymentUrl']}")
                                        print(f"🎯 Listening for {payment_result['paymentDetails']['amount']} USDC")
                                        print(f"📊 Split: {payment_result['paymentDetails']['splitPercentage']}% to {payment_result['paymentDetails']['scopeAgent']['ens']}")
                                        print(f"         {100 - payment_result['paymentDetails']['splitPercentage']}% to {payment_result['paymentDetails']['coderAgent']['ens']}")
                                    break
                except json.JSONDecodeError as e:
                    print(f"Failed to parse result: {e}")
                    print(f"Raw text: {result.text}")
            else:
                print(f"Unexpected result format: {result}")
                
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print(f"   Type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
    
    print("\n✅ Done!")


if __name__ == "__main__":
    asyncio.run(main()) 