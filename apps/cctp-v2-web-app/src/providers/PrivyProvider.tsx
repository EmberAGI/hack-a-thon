"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { privyAppId, privyConfig } from "@/lib/privyConfig";

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  return (
    <BasePrivyProvider appId={privyAppId} config={privyConfig}>
      {children}
    </BasePrivyProvider>
  );
}
