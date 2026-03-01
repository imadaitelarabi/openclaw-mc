/**
 * useExtensionActionBar
 *
 * A standardized hook that provides the contract for Extension Action Bar
 * actions rendered at the bottom of GitHub extension panels.
 *
 * Supports Write/Read button groups with optional dropdown items, disabled
 * states with tooltip messages, loading spinners, and error display.
 *
 * @example
 * ```tsx
 * const bar = useExtensionActionBar({
 *   actions: [
 *     {
 *       id: "merge",
 *       label: "Merge",
 *       variant: "success",
 *       disabled: pr.draft,
 *       disabledReason: pr.draft ? "Draft PRs cannot be merged" : undefined,
 *       loading: actionLoading === "merge",
 *       dropdownItems: [
 *         { id: "merge-squash", label: "Squash and merge", onClick: () => handleMerge("squash") },
 *         { id: "merge-rebase", label: "Rebase and merge", onClick: () => handleMerge("rebase") },
 *       ],
 *       onClick: () => handleMerge("merge"),
 *     },
 *     {
 *       id: "close",
 *       label: "Close PR",
 *       variant: "danger",
 *       loading: actionLoading === "close",
 *       onClick: () => setShowConfirm({ action: "close" }),
 *     },
 *   ],
 *   error: actionError,
 *   onDismissError: () => setActionError(null),
 * });
 *
 * return <ExtensionActionBar bar={bar} />;
 * ```
 */

export interface ActionBarDropdownItem {
  /** Unique identifier for this item */
  id: string;
  /** Human-readable label shown in the dropdown */
  label: string;
  /** Called when the item is selected */
  onClick: () => void;
  /** When true the item is non-interactive */
  disabled?: boolean;
  /** Tooltip shown on a disabled item */
  disabledReason?: string;
  /** When true a visual separator is inserted before this item */
  separator?: boolean;
}

export type ActionBarVariant = "default" | "danger" | "success" | "ghost";

export interface ActionBarAction {
  /** Unique identifier used for loading/disabled keying */
  id: string;
  /** Button label */
  label: string;
  /** Optional icon key rendered in icon-first action bars */
  icon?: string;
  /**
   * Visual style variant.
   * - "default"  → muted/outlined secondary button
   * - "danger"   → red destructive button
   * - "success"  → green primary button
   * - "ghost"    → plain text button
   */
  variant?: ActionBarVariant;
  /** When true the button is disabled and pointer-events removed */
  disabled?: boolean;
  /** Short message shown via title attribute when the button is disabled */
  disabledReason?: string;
  /** Shows a spinner inside the button and prevents double-clicks */
  loading?: boolean;
  /**
   * Primary click handler.
   * When dropdownItems is provided this fires on the left segment of a
   * split-button; callers may still invoke the default action here.
   */
  onClick?: () => void;
  /**
   * Optional dropdown items rendered in a secondary menu.
   * When provided the action renders as a split-button.
   */
  dropdownItems?: ActionBarDropdownItem[];
}

export interface ExtensionActionBarState {
  /** Ordered list of actions to display */
  actions: ActionBarAction[];
  /** Error message to display above the action bar (null = no error) */
  error: string | null;
  /** Called when the user dismisses the error banner */
  onDismissError?: () => void;
}

/**
 * Builds the action bar state object consumed by `<ExtensionActionBar>`.
 * Keeps the hook layer thin so panels only need to pass their action schema.
 */
export function useExtensionActionBar(options: {
  actions: ActionBarAction[];
  error?: string | null;
  onDismissError?: () => void;
}): ExtensionActionBarState {
  return {
    actions: options.actions,
    error: options.error ?? null,
    onDismissError: options.onDismissError,
  };
}
