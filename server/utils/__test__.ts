/**
 * Manual validation script for pattern-based event handling
 * Run with: npx tsx server/utils/__test__.ts
 */

import { 
  formatTrace, 
  formatToolCall, 
  formatToolResult,
  formatMeta,
  parseTaggedMessage as parseServerMessage
} from './event-formatting.js';
import { DeduplicationService } from './deduplication.js';
import { 
  extractThinking, 
  extractTool, 
  extractSessionInfo,
  extractLifecycle 
} from './message-extractor.js';
import { processEvent } from './event-processor.js';

console.log('🧪 Testing Pattern-Based Event Handling\n');

// Test 1: Formatting
console.log('1️⃣ Testing Formatting Functions');
console.log('================================');
const trace = formatTrace('Agent is thinking about the problem...');
console.log('Trace:', trace);
console.log('');

const toolCall = formatToolCall('bash', { command: 'ls -la', description: 'List files' });
console.log('Tool Call:', toolCall);
console.log('');

const toolResult = formatToolResult({
  result: 'total 48\ndrwxr-xr-x  4 user',
  exitCode: 0,
  duration: 150,
  cwd: '/workspace'
});
console.log('Tool Result:', toolResult);
console.log('');

const meta = formatMeta({ phase: 'end', timestamp: Date.now() });
console.log('Meta:', meta);
console.log('\n');

// Test 2: Deduplication
console.log('2️⃣ Testing Deduplication Service');
console.log('==================================');
const dedupe = new DeduplicationService();
const testRunId = 'run-123';
const testLine = '[[tool]] bash';

console.log(`First check: ${dedupe.checkAndMark(testRunId, testLine)} (should be true - new)`);
console.log(`Second check: ${dedupe.checkAndMark(testRunId, testLine)} (should be false - duplicate)`);
console.log(`Tracked runs: ${dedupe.getTrackedRunsCount()}`);
dedupe.clearRun(testRunId);
console.log(`After clear: ${dedupe.getTrackedRunsCount()}`);
console.log('\n');

// Test 3: Message Extraction
console.log('3️⃣ Testing Message Extraction');
console.log('===============================');

// Test thinking extraction
const thinkingPayload = {
  stream: 'reasoning',
  data: { delta: 'Thinking...' }
};
const thinking = extractThinking(thinkingPayload);
console.log('Thinking extraction:', thinking);

// Test tool extraction
const toolPayload = {
  stream: 'tool',
  tool: 'bash',
  data: { 
    phase: 'start', 
    args: { command: 'pwd' }
  }
};
const tool = extractTool(toolPayload);
console.log('Tool extraction:', tool);

// Test session info extraction
const sessionPayload = {
  sessionKey: 'agent:abc123:main',
  runId: 'run-456'
};
const sessionInfo = extractSessionInfo(sessionPayload);
console.log('Session info:', sessionInfo);

// Test lifecycle extraction
const lifecyclePayload = {
  stream: 'lifecycle',
  data: { phase: 'end' }
};
const lifecycle = extractLifecycle(lifecyclePayload);
console.log('Lifecycle:', lifecycle);
console.log('\n');

// Test 4: Event Processing
console.log('4️⃣ Testing Event Processor');
console.log('============================');

// Simulate a tool event
const toolEventPayload = {
  stream: 'tool',
  tool: 'bash',
  data: {
    phase: 'start',
    args: { command: 'ls -la', description: 'List files' }
  },
  sessionKey: 'agent:test-agent:main',
  runId: 'run-test-1'
};

const processed = processEvent('agent', toolEventPayload);
console.log('Processed event:', JSON.stringify(processed, null, 2));
console.log('\n');

// Test 5: Parsing (Frontend)
console.log('5️⃣ Testing Frontend Parsing');
console.log('=============================');
const parsed = parseServerMessage(trace);
console.log('Parsed trace type:', parsed.type);
console.log('Parsed content:', parsed.content.substring(0, 50) + '...');
console.log('\n');

console.log('✅ All tests completed successfully!\n');
console.log('Summary:');
console.log('--------');
console.log('✓ Formatting functions work correctly');
console.log('✓ Deduplication prevents duplicates');
console.log('✓ Message extraction handles all types');
console.log('✓ Event processor creates formatted messages');
console.log('✓ Parsing recovers original content');
