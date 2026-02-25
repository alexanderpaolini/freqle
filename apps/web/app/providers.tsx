"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { Toaster } from "@/components/ui/sonner";

type AppThemeProviderProps = Omit<ThemeProviderProps, "children"> & {
  children: React.ReactNode;
};

function AppThemeProvider({ children, ...props }: AppThemeProviderProps) {
  return React.createElement(NextThemesProvider, props, children);
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SessionProvider>
        {children}
        <Toaster position="bottom-center" richColors />
      </SessionProvider>
    </AppThemeProvider>
  );
}
