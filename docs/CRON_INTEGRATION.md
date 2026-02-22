# Cron Job Integration - Implementation Documentation

## Overview

This document describes the implementation of native cron job integration in OpenClaw MC, following the requirements specified in the feature request.

## Architecture

### Design Principles

1. **Thin Proxy Pattern**: All cron operations use generic `gateway.call` RPC pass-throughs to the OpenClaw Gateway
2. **Native Implementation**: Built into core components (Status Bar, Panels) rather than as an extension
3. **Consistent UX**: Mirrors the Agent management workflow for familiar user experience
4. **Real-time Updates**: Listens for `event:cron` on WebSocket to update UI state

## Components

### Type Definitions (`types/cron.ts`)

Defines the core data structures for cron jobs:

- `CronJob`: Complete job configuration with schedule, payload, delivery settings
- `CronStatus`: Overall scheduler status (enabled, job count, next wake time)
- `CronRun`: Execution history entry with status and session key
- `Schedule`: Schedule configuration (cron expression, interval, timezone)
- `CronEvent`: Real-time event payload for job updates
- `CronPayload`: Includes a required `model`, ensuring every scheduled message targets an explicit model before being handed to the gateway

### Server Handlers (`server/handlers/cron.handler.ts`)

Implements RPC pass-through handlers:

- `handleCronList`: Fetch all cron jobs
- `handleCronStatus`: Get scheduler status
- `handleCronAdd`: Create new job
- `handleCronUpdate`: Modify existing job
- `handleCronDelete`: Remove job
- `handleCronRuns`: Get run history
- `handleCronRun`: Trigger immediate execution

All handlers use the gateway.call() method to forward requests to the OpenClaw Gateway.

### Hooks

#### `useCronJobs` (`hooks/useCronJobs.ts`)

Manages cron jobs list and operations:

- Loads jobs and status on mount
- Listens for WebSocket messages (responses and events)
- Provides CRUD operations: `addJob`, `updateJob`, `deleteJob`
- Handles real-time updates via `event:cron` messages
- Uses pending request tracking for timeout handling

#### `useCronRuns` (`hooks/useCronRuns.ts`)

Manages run history for a specific job:

- Loads runs for given jobId
- Provides `triggerRun` for manual execution
- Listens for job_started and job_finished events
- Updates run list in real-time

### UI Components

#### `CronStatusBarItem` (`components/cron/CronStatusBarItem.tsx`)

Status bar integration:

- Shows next scheduled job with countdown (e.g., "⏰ Daily Brief in 5m")
- Displays running state with pulsing indicator (e.g., "● Running: Weekly Summary")
- Opens dropdown menu listing all jobs, sorted by nextWake/priority
- Running jobs appear at top with animation
- Disabled jobs shown with muted styling

#### `CronPanel` (`components/cron/CronPanel.tsx`)

Dedicated panel for job control:

- **Header**: Job name, schedule (cron expression), next run time, enabled status
- **Run Picker**: Dropdown to switch between current and historical runs
- **Transcript Viewer**: Read-only chat history from selected run (reuses ChatMessageItem)
- **Control Strip**:
  - Force Run: Triggers immediate execution
  - Reschedule: Quick schedule update (optional callback)
  - Edit: Full configuration form (optional callback)
  - Delete: Remove job with confirmation

#### Create & Update Cron Panels (`components/panels/CreateCronPanel.tsx`, `components/panels/UpdateCronPanel.tsx`)

- Both panels render the shared `ModelSelector` component (the same searchable dropdown used in the status bar) so users can choose the model that will execute the scheduled message. `PanelContainer` injects the `models` array and a `defaultModel` derived from `sessionSettings.model`, which means the creation flow starts with the active model already selected when available.
- Model selection is mandatory: the form blocks submission when the list is empty (showing a descriptive callout) or when no model is picked, and it surfaces a reminder that the choice affects the shared session target. When submitted, the selected model fills `payload.model` (alongside the cron message, schedule, and `agentId`) before calling `cron.add` / `cron.update`.
- This guarantees every cron job stores the model it should run against so scheduled runs stay deterministic rather than inheriting an unexpected default.

### Integration

#### Panel System (`components/panels/PanelContainer.tsx`)

- Added `'cron'` to PanelType union
- Renders CronPanel when panel.type === 'cron'
- Requires `panel.data.jobId` to identify which job to display
- Passes cronJobs, wsRef, and action callbacks as props
- Supplies `models` and `defaultModel` (derived from `sessionSettings.model` or the first available model) to the create/update Cron panels so they can render the searchable `ModelSelector`.

#### Status Bar (`components/layout/StatusBar.tsx`)

- Added optional cron props: `cronJobs`, `cronStatus`, `isCronMenuOpen`
- Renders CronStatusBarItem when jobs exist and scheduler is enabled
- Handles menu toggle and job selection

#### Main App (`app/page.tsx`)

- Initializes `useCronJobs` hook with wsRef
- Manages `isCronMenuOpen` state
- Implements handlers:
  - `handleSelectCronJob`: Opens cron panel for selected job
  - `handleForceRunCronJob`: Triggers job execution
  - `handleDeleteCronJob`: Removes job and closes related panels
- Passes cron state to StatusBar and PanelContainer

## RPC Protocol

### Request/Response Patterns

#### List Jobs

```typescript
// Request
{ type: 'cron.list', requestId: 'uuid' }

// Response
{ type: 'cron.list.response', requestId: 'uuid', jobs: CronJob[] }
```

#### Get Status

```typescript
// Request
{ type: 'cron.status', requestId: 'uuid' }

// Response
{ type: 'cron.status.response', requestId: 'uuid', status: CronStatus }
```

#### Add Job

```typescript
// Request
{ type: 'cron.add', requestId: 'uuid', job: Partial<CronJob> }

// Response
{ type: 'cron.add.response', requestId: 'uuid', job: CronJob }
```

#### Update Job

```typescript
// Request
{ type: 'cron.update', requestId: 'uuid', jobId: string, updates: Partial<CronJob> }

// Response
{ type: 'cron.update.response', requestId: 'uuid', job: CronJob }
```

#### Delete Job

```typescript
// Request
{ type: 'cron.delete', requestId: 'uuid', jobId: string }

// Response
{ type: 'cron.delete.response', requestId: 'uuid', jobId: string }
```

#### Get Run History

```typescript
// Request
{ type: 'cron.runs', requestId: 'uuid', jobId: string, limit?: number }

// Response
{ type: 'cron.runs.response', requestId: 'uuid', entries: CronRun[] }
```

#### Trigger Run

```typescript
// Request
{ type: 'cron.run', requestId: 'uuid', jobId: string, mode: 'force' | 'schedule' }

// Response
{ type: 'cron.run.response', requestId: 'uuid', run: CronRun }
```

### Real-time Events

```typescript
// WebSocket event
{
  type: 'event',
  event: 'cron',
  payload: {
    type: 'job_added' | 'job_updated' | 'job_deleted' | 'job_started' | 'job_finished' | 'status_changed',
    job?: CronJob,
    jobId?: string,
    status?: CronStatus,
    run?: CronRun
  }
}
```

## Session History Loading

Cron runs create isolated sessions with key format: `cron:{jobId}:{runId}`

To load transcript for a run:

```typescript
sendMessage({
  type: "chat.history.load",
  sessionKey: run.sessionKey,
  limit: 100,
});
```

The response will be a standard chat history message that can be rendered using ChatMessageItem components.

## Usage Examples

### Opening a Cron Panel

```typescript
const handleSelectCronJob = (jobId: string) => {
  const job = cronJobs.find((j) => j.id === jobId);
  if (job) {
    openPanel("cron", { jobId, jobName: job.name });
  }
};
```

### Deleting a Job

```typescript
const handleDeleteCronJob = async (jobId: string) => {
  try {
    await deleteCronJob(jobId);
    // Close any open panels for this job
    layout.panels.forEach((panel) => {
      if (panel.type === "cron" && panel.data?.jobId === jobId) {
        closePanel(panel.id);
      }
    });
  } catch (err) {
    // Handle error
  }
};
```

## Future Enhancements

### Not Yet Implemented

1. **Reschedule Dialog**: Quick UI for updating schedule
2. **Edit Form**: Full job configuration editor
3. **Job Creation**: UI for adding new cron jobs
4. **Advanced Filtering**: Filter runs by status, date range
5. **Run Comparison**: View diffs between runs
6. **Notifications**: Toast notifications for job events

### Potential Improvements

1. **Persistent State**: Save open cron panels across sessions
2. **Panel Settings**: Allow customizing transcript view (tools/reasoning)
3. **Export Runs**: Download run transcripts as JSON/text
4. **Job Templates**: Pre-configured job examples
5. **Scheduling Helper**: Visual cron expression builder

## Testing Checklist

- [ ] Jobs list loads correctly
- [ ] Status bar shows next job and updates
- [ ] Clicking status bar item opens menu
- [ ] Selecting job from menu opens panel
- [ ] Panel displays job info and run history
- [ ] Run picker switches between runs
- [ ] Transcript loads and renders correctly
- [ ] Force Run triggers execution
- [ ] Delete removes job and closes panel
- [ ] Real-time events update UI
- [ ] Multiple panels can show different jobs
- [ ] Panel state persists during session
- [ ] WebSocket reconnection works
- [ ] Error handling displays messages

## Known Limitations

1. **Gateway Dependency**: Requires OpenClaw Gateway v0.x+ with cron support
2. **No Offline Support**: Cron management requires active gateway connection
3. **Limited History**: Run history limited by gateway retention policy
4. **Basic Actions**: Advanced actions (reschedule, edit) need implementation
5. **No Validation**: Schedule expressions not validated in UI

## References

- Feature Request: [Feature] Native Cron Job Integration
- Gateway API: OpenClaw Gateway RPC Documentation
- Panel System: `contexts/PanelContext.tsx`
- WebSocket Protocol: `server/core/GatewayClient.ts`
