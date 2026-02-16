import { ChevronDown } from 'lucide-react';

interface ScrollToBottomButtonProps {
  onClick: () => void;
  visible: boolean;
}

export function ScrollToBottomButton({ onClick, visible }: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 md:bottom-24 right-4 md:right-6 bg-primary/90 hover:bg-primary text-primary-foreground rounded-full p-3 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 z-10"
      aria-label="Scroll to bottom"
    >
      <ChevronDown className="w-5 h-5" />
    </button>
  );
}
