import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate three wallets
const wallets = {
  SCOPE_AGENT: privateKeyToAccount(generatePrivateKey()),
  PAYMENT_AGENT: privateKeyToAccount(generatePrivateKey()),
  CODER_AGENT: privateKeyToAccount(generatePrivateKey())
};

// Create .env content
let envContent = '# Generated EOA Wallets for Agents\n';
envContent += '# Generated on: ' + new Date().toISOString() + '\n\n';

for (const [name, wallet] of Object.entries(wallets)) {
  envContent += `# ${name} Wallet\n`;
  envContent += `${name}_ADDRESS=${wallet.address}\n`;
  envContent += `${name}_PRIVATE_KEY=${generatePrivateKey()}\n\n`;
}

// Wait, we need to store the private keys properly
const privateKeys = {
  SCOPE_AGENT: generatePrivateKey(),
  PAYMENT_AGENT: generatePrivateKey(),
  CODER_AGENT: generatePrivateKey()
};

// Regenerate wallets with stored private keys
const walletsWithKeys = {
  SCOPE_AGENT: { account: privateKeyToAccount(privateKeys.SCOPE_AGENT), privateKey: privateKeys.SCOPE_AGENT },
  PAYMENT_AGENT: { account: privateKeyToAccount(privateKeys.PAYMENT_AGENT), privateKey: privateKeys.PAYMENT_AGENT },
  CODER_AGENT: { account: privateKeyToAccount(privateKeys.CODER_AGENT), privateKey: privateKeys.CODER_AGENT }
};

// Recreate .env content with proper private keys
envContent = '# Generated EOA Wallets for Agents\n';
envContent += '# Generated on: ' + new Date().toISOString() + '\n\n';

for (const [name, wallet] of Object.entries(walletsWithKeys)) {
  envContent += `# ${name} Wallet\n`;
  envContent += `${name}_ADDRESS=${wallet.account.address}\n`;
  envContent += `${name}_PRIVATE_KEY=${wallet.privateKey}\n\n`;
}

// Write to each agent's directory
const agents = ['scope-agent', 'payment-agent', 'coder-agent'];
for (const agent of agents) {
  const envPath = path.join(__dirname, agent, '.env');
  fs.writeFileSync(envPath, envContent);
  console.log(`Created .env file for ${agent}`);
}

// Also create a summary file
let summaryContent = '# Agent Wallet Addresses\n\n';
for (const [name, wallet] of Object.entries(walletsWithKeys)) {
  summaryContent += `${name}: ${wallet.account.address}\n`;
}

fs.writeFileSync(path.join(__dirname, 'wallet-addresses.txt'), summaryContent);

console.log('\nWallet generation complete!');
console.log('\nAddresses:');
for (const [name, wallet] of Object.entries(walletsWithKeys)) {
  console.log(`${name}: ${wallet.account.address}`);
} 