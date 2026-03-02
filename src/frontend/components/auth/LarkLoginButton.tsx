"use client";

import { Button } from "@/frontend/components/ui";

/**
 * Single login button — navigates to Lark OAuth.
 * Role is assigned server-side (first user = super_admin, others = agent).
 */
export function LarkLoginButton() {
  const handleLogin = () => {
    window.location.href = "/api/auth/lark";
  };

  return (
    <Button size="lg" onClick={handleLogin} className="w-full justify-center">
      <span className="material-symbols-outlined text-[20px]">login</span>
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 17.5L8.5 12L13 16.5L21 6.5V11L13 20.5L8.5 16L3 21.5V17.5Z" />
      </svg>
      Sign in with Lark
    </Button>
  );
}
