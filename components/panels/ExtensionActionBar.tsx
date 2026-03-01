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
import {
  AlertCircle,
  ChevronDown,
  Circle,
  Code2,
  ExternalLink,
  GitMerge,
  Loader2,
  MessageSquare,
  RotateCcw,
  UserPlus,
  X,
} from "lucide-react";
import type {
  ExtensionActionBarState,
  ActionBarAction,
  ActionBarVariant,
} from "@/hooks/useExtensionActionBar";

// ── Style helpers ────────────────────────────────────────────────────────────

function variantColor(variant: ActionBarVariant = "default"): string {
  switch (variant) {
    case "success":
      return "text-green-600 hover:text-green-700";
    case "danger":
      return "text-red-600 hover:text-red-700";
    case "ghost":
      return "text-muted-foreground hover:text-foreground";
    default:
      return "text-foreground/90 hover:text-foreground";
  }
}

function textActionCls(variant: ActionBarVariant = "default"): string {
  const color = variantColor(variant);
  return `inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${color}`;
}

function menuItemCls(variant: ActionBarVariant = "default"): string {
  const color = variantColor(variant);
  return `outline-none focus:bg-accent hover:bg-accent text-xs ${color} cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed`;
}

function getActionIcon(action: ActionBarAction) {
  switch (action.icon ?? action.id) {
    case "request-review":
    case "assign":
      return UserPlus;
    case "ready-for-review":
      return Circle;
    case "merge":
      return GitMerge;
    case "close":
      return X;
    case "reopen":
      return RotateCcw;
    case "review-comments":
      return MessageSquare;
    case "open-github":
      return ExternalLink;
    case "open-vscode":
      return Code2;
    default:
      return Circle;
  }
}

const actionButtonLabelCls =
  "inline-block max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-150 group-hover:ml-1 group-hover:max-w-[176px] group-hover:opacity-100 group-focus-visible:ml-1 group-focus-visible:max-w-[176px] group-focus-visible:opacity-100";

// ── Sub-components ───────────────────────────────────────────────────────────

interface ActionButtonProps {
  action: ActionBarAction;
  anyLoading: boolean;
}

function ActionButton({ action, anyLoading }: ActionButtonProps) {
  const isDisabled = action.disabled || action.loading || anyLoading;
  const ActionIcon = getActionIcon(action);
  const titleAttr = action.disabled
    ? (action.disabledReason ?? "Action unavailable")
    : action.loading
      ? "Loading…"
      : undefined;

  if (action.dropdownItems && action.dropdownItems.length > 0) {
    // Split-button: primary label fires onClick; chevron opens the dropdown
    return (
      <div className="relative inline-flex items-center">
        <button
          onClick={action.onClick}
          disabled={isDisabled}
          title={titleAttr}
          aria-label={action.label}
          data-action-id={action.id}
          className={`${textActionCls(action.variant)} group h-7 px-1.5 justify-center rounded hover:bg-accent`}
        >
          {action.loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ActionIcon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span className={actionButtonLabelCls}>{action.label}</span>
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              disabled={isDisabled}
              title="More options"
              aria-label={`${action.label} options`}
              className={`${textActionCls(action.variant)} ml-0.5 h-7 w-5 justify-center rounded hover:bg-accent`}
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
                  {item.separator && <DropdownMenu.Separator className="my-1 h-px bg-border" />}
                  <DropdownMenu.Item
                    disabled={item.disabled}
                    onSelect={item.onClick}
                    title={item.disabled ? (item.disabledReason ?? "Unavailable") : undefined}
                    className={`px-3 py-1.5 rounded-md ${menuItemCls(action.variant)}`}
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
      data-action-id={action.id}
      className={`${textActionCls(action.variant)} group h-7 px-1.5 justify-center rounded hover:bg-accent`}
    >
      {action.loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <ActionIcon className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      <span className={actionButtonLabelCls}>{action.label}</span>
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
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-muted-foreground">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} anyLoading={anyLoading} />
          ))}
        </div>
      )}
    </div>
  );
}
