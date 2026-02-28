"use client";

/**
 * ExtensionActionBar
 *
 * Themed action bar rendered at the bottom of GitHub extension panels.
 * Consumes the state produced by `useExtensionActionBar`.
 *
 * - Action buttons support disabled states, loading spinners, and optional
 *   dropdown items rendered via @radix-ui/react-dropdown-menu.
 * - An inline error banner is shown when `bar.error` is non-null.
 * - All interactive elements carry accessible `title` / `aria-label`
 *   attributes so screen-readers get context on disabled states.
 */

import { Fragment } from "react";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AlertCircle, ChevronDown, Loader2, X } from "lucide-react";
import type { ExtensionActionBarState, ActionBarAction, ActionBarVariant } from "@/hooks/useExtensionActionBar";

// ── Style helpers ────────────────────────────────────────────────────────────

function variantBase(variant: ActionBarVariant = "default"): string {
  switch (variant) {
    case "success":
      return "bg-green-600 hover:bg-green-700 text-white";
    case "danger":
      return "bg-red-600 hover:bg-red-700 text-white";
    case "ghost":
      return "text-muted-foreground hover:text-foreground hover:bg-accent";
    default:
      return "bg-muted hover:bg-muted/80 text-foreground border border-border";
  }
}

function splitLeftCls(variant: ActionBarVariant = "default"): string {
  const base = variantBase(variant);
  return `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-l transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${base}`;
}

function splitRightCls(variant: ActionBarVariant = "default"): string {
  switch (variant) {
    case "success":
      return "px-1.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white border-l border-green-500 rounded-r transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    case "danger":
      return "px-1.5 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white border-l border-red-500 rounded-r transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    default:
      return "px-1.5 py-1.5 text-xs bg-muted hover:bg-muted/80 text-foreground border border-l border-border rounded-r transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  }
}

function simpleCls(variant: ActionBarVariant = "default"): string {
  const base = variantBase(variant);
  return `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${base}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface ActionButtonProps {
  action: ActionBarAction;
  anyLoading: boolean;
}

function ActionButton({ action, anyLoading }: ActionButtonProps) {
  const isDisabled = action.disabled || action.loading || anyLoading;
  const titleAttr = action.disabled
    ? (action.disabledReason ?? "Action unavailable")
    : action.loading
      ? "Loading…"
      : undefined;

  if (action.dropdownItems && action.dropdownItems.length > 0) {
    // Split-button: left segment fires primary onClick, right opens dropdown
    return (
      <div className="relative inline-flex rounded overflow-hidden">
        {/* Primary segment */}
        <button
          onClick={action.onClick}
          disabled={isDisabled}
          title={titleAttr}
          aria-label={action.label}
          className={splitLeftCls(action.variant)}
        >
          {action.loading ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : null}
          {action.label}
        </button>

        {/* Dropdown chevron segment */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              disabled={isDisabled}
              title="More options"
              aria-label={`${action.label} options`}
              className={splitRightCls(action.variant)}
            >
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              align="end"
              className="z-[120] min-w-[180px] bg-popover border border-border rounded-md shadow-lg p-1"
            >
              {action.dropdownItems.map((item) => (
                <Fragment key={item.id}>
                  {item.separator && (
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  )}
                  <DropdownMenu.Item
                    disabled={item.disabled}
                    onSelect={item.onClick}
                    title={item.disabled ? (item.disabledReason ?? "Unavailable") : undefined}
                    className="px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs text-foreground cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                  >
                    {item.label}
                  </DropdownMenu.Item>
                </Fragment>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  }

  // Simple button
  return (
    <button
      onClick={action.onClick}
      disabled={isDisabled}
      title={titleAttr}
      aria-label={action.label}
      className={simpleCls(action.variant)}
    >
      {action.loading ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : null}
      {action.label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ExtensionActionBarProps {
  bar: ExtensionActionBarState;
}

/**
 * Renders a sticky action bar at the bottom of an extension panel.
 * Pass the object returned by `useExtensionActionBar` as the `bar` prop.
 */
export function ExtensionActionBar({ bar }: ExtensionActionBarProps) {
  const { actions, error, onDismissError } = bar;

  if (actions.length === 0 && !error) return null;

  const anyLoading = actions.some((a) => a.loading);

  return (
    <div className="flex-shrink-0 border-t border-border">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 px-3 py-2 text-xs text-destructive bg-destructive/10 border-b border-destructive/20"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          {onDismissError && (
            <button
              onClick={onDismissError}
              aria-label="Dismiss error"
              className="flex-shrink-0 hover:opacity-70"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} anyLoading={anyLoading} />
          ))}
        </div>
      )}
    </div>
  );
}
