"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/hooks/useToast";
import { ExtensionProvider } from "@/contexts/ExtensionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemeProvider>
      <ToastProvider>
        <ExtensionProvider>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </ExtensionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
