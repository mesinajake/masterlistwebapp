"use client";

import { LarkLoginButton } from "@/frontend/components/auth/LarkLoginButton";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light dark:bg-bg-dark">
      <div className="w-full max-w-md px-6">
        <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl border border-border-light dark:border-border-dark p-8 text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Master List
            </h1>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-2">
              Sign in to access the centralized data management platform
            </p>
          </div>

          {/* Single login button */}
          <LarkLoginButton />

          {/* Footer */}
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-8">
            Only authorized team members can access this application.
            <br />
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
