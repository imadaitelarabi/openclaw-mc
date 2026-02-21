# Visual Guide: Pattern-Based Event Handling

This guide illustrates how the new pattern-based event handling appears in the OpenClaw MC UI.

## 🎨 UI Components

### 1. Live Thinking Trace (Purple Reasoning Card)

When an agent is actively reasoning:

```
┌─────────────────────────────────────────────────────┐
│ 🧠 Reasoning...                           ◯ pulsing │
├─────────────────────────────────────────────────────┤
│ ▾ Thinking process                                  │
│                                                     │
│   I need to understand the user's request first.   │
│   They want to implement a new feature that        │
│   handles events in a structured way...▊           │
│                                                     │
└─────────────────────────────────────────────────────┘
     purple gradient background (purple-500/10)
     animated cursor (▊) at the end
     auto-expanding as content streams
```

### 2. Completed Reasoning Trace

After reasoning completes:

```
┌─────────────────────────────────────────────────────┐
│ 🧠 Reasoning                                        │
├─────────────────────────────────────────────────────┤
│ ▸ Thinking process                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
     Collapsed by default
     Click to expand and view full reasoning
```

### 3. Tool Call (Amber Card)

When a tool is invoked:

```
┌─────────────────────────────────────────────────────┐
│ ◯ Tool: bash                                   ⋯    │
├─────────────────────────────────────────────────────┤
│ ▸ Arguments                                         │
│                                                     │
└─────────────────────────────────────────────────────┘
     amber background (amber-500/10)
     pulsing indicator (◯) shows active
     status indicator (⋯) shows in progress
```

Expanded view:

```
┌─────────────────────────────────────────────────────┐
│ ◯ Tool: bash                                   ⋯    │
├─────────────────────────────────────────────────────┤
│ ▾ Arguments                                         │
│   {                                                 │
│     "command": "ls -la",                            │
│     "description": "List files in directory"        │
│   }                                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4. Tool Result (Emerald Card)

When a tool completes:

```
┌─────────────────────────────────────────────────────┐
│ ● ✓ Tool Result                                     │
├─────────────────────────────────────────────────────┤
│ [Exit: 0] [150ms] [/workspace]                      │
│                                                     │
│ ▸ Output                                            │
│                                                     │
└─────────────────────────────────────────────────────┘
     emerald background (emerald-500/10)
     solid indicator (●) shows completed
     metadata badges with rounded corners
```

Expanded view:

```
┌─────────────────────────────────────────────────────┐
│ ● ✓ Tool Result                                     │
├─────────────────────────────────────────────────────┤
│ [Exit: 0] [150ms] [/workspace]                      │
│                                                     │
│ ▾ Output                                            │
│   total 48                                          │
│   drwxr-xr-x  4 user  staff   128 Jan 15 10:30 .   │
│   drwxr-xr-x 10 user  staff   320 Jan 15 10:25 ..  │
│   -rw-r--r--  1 user  staff  1024 Jan 15 10:30 file│
│                                                     │
└─────────────────────────────────────────────────────┘
     Scrollable if content exceeds max-height
```

## 📱 Complete Conversation Example

Here's how a typical agent interaction flows:

```
┌─────────────────────────────────────────────────────┐
│                                        You          │
│                     ┌─────────────────────────────┐ │
│                     │ List the files in /workspace│ │
│                     └─────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Assistant                                           │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 🧠 Reasoning...                      ◯ pulsing  │ │
│ │ ▾ Thinking process                              │ │
│ │   The user wants to list files in /workspace.  │ │
│ │   I'll use the bash tool to execute ls -la...▊ │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │ ◯ Tool: bash                              ⋯     │ │
│ │ ▸ Arguments                                     │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │ ● ✓ Tool Result                                 │ │
│ │ [Exit: 0] [150ms] [/workspace]                  │ │
│ │ ▸ Output                                        │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────┐ │
│ │ Here are the files in the workspace:            │ │
│ │                                                 │ │
│ │ - README.md                                     │ │
│ │ - src/ (directory)                              │ │
│ │ - package.json                                  │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## 🎯 Key Visual Differences

### Before (Old Format)

- No live reasoning display
- Tool calls mixed with regular messages
- No metadata on tool results
- Plain text output
- Possible duplicates

### After (New Format)

- **Live Reasoning**: Purple cards with streaming content
- **Distinct Tool Cards**: Amber for calls, emerald for results
- **Rich Metadata**: Exit codes, duration, CWD displayed
- **Structured Format**: Clean, parseable tags
- **No Duplicates**: Guaranteed single appearance

## 🎨 Color System

| Type        | Background     | Border         | Icon   |
| ----------- | -------------- | -------------- | ------ |
| Thinking    | purple-500/10  | purple-500/30  | 🧠     |
| Tool Call   | amber-500/10   | amber-500/30   | Varies |
| Tool Result | emerald-500/10 | emerald-500/30 | ✓      |
| Assistant   | secondary/80   | secondary      | None   |
| User        | primary        | primary        | None   |

## 🔄 Animation States

### Reasoning Card

- **Streaming**: Pulsing dot animation
- **Cursor**: Blinking block cursor (▊)
- **Expand**: Smooth height transition

### Tool Card

- **Active**: Pulsing dot animation
- **Completing**: Fade to solid
- **Expand**: Smooth reveal of content

### Tool Result Card

- **Appearing**: Fade-in animation
- **Metadata**: Stagger animation for badges
- **Expand**: Smooth height transition

## 📐 Responsive Behavior

### Desktop (≥768px)

- Cards max width: 85% of container
- Full metadata visible
- Expanded by default (reasoning)

### Mobile (<768px)

- Cards max width: 95% of container
- Metadata wraps to multiple lines
- Collapsed by default (all)
- Touch-friendly expand/collapse

## ♿ Accessibility Features

- `aria-label` on interactive elements
- Proper role attributes for cards
- Keyboard navigation support
- Screen reader announcements
- Focus indicators on expand/collapse
- High contrast in both light/dark modes

---

**Note**: All visual styling respects user's theme preference (light/dark mode) and uses Tailwind's built-in dark mode utilities.
