import { PrivyClientConfig } from "@privy-io/react-auth";
import {
  sepolia,
  avalancheFuji,
  baseSepolia,
  sonicBlazeTestnet,
  lineaSepolia,
  arbitrumSepolia,
  worldchainSepolia,
  optimismSepolia,
  unichainSepolia,
  polygonAmoy,
} from "viem/chains";
import { defineChain } from "viem";

// Custom Codex chain definition
const codexTestnet = defineChain({
  id: 812242,
  name: "Codex Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Codex",
    symbol: "CDX",
  },
  rpcUrls: {
    default: {
      http: ["https://812242.rpc.thirdweb.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Codex Explorer",
      url: "https://explorer.codex-stg.xyz/",
    },
  },
  testnet: true,
});

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;

export const privyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email", "sms"],
  appearance: {
    theme: "light",
    accentColor: "#676FFF",
    logo: undefined,
  },
  embeddedWallets: {
    createOnLogin: "users-without-wallets",
    requireUserPasswordOnCreate: false,
  },
  defaultChain: sepolia,
  supportedChains: [
    sepolia,
    avalancheFuji,
    baseSepolia,
    sonicBlazeTestnet,
    lineaSepolia,
    arbitrumSepolia,
    worldchainSepolia,
    optimismSepolia,
    codexTestnet,
    unichainSepolia,
    polygonAmoy,
  ],
};
