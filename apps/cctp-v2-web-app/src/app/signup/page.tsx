"use client";

import { SignupWithWallet } from "@/components/SignupWithWallet";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to CCTP
          </h1>
          <p className="text-gray-600">
            Cross-Chain Transfer Protocol - Create your wallet to get started
          </p>
        </div>
        
        <SignupWithWallet />
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              Go to Transfer App
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
