# Mission Control

**Real-time monitoring and management interface for OpenClaw Gateway**

Mission Control is a Next.js-based web application that provides a sleek, responsive dashboard for interacting with OpenClaw agents, managing gateway connections, and monitoring agent activities in real-time.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 🛰️ Multi-Gateway Support
- **Dynamic Gateway Management**: Connect to multiple OpenClaw gateways (local or remote)
- **Seamless Switching**: Switch between gateways without restarting the application
- **Persistent Configuration**: Gateway settings stored in `~/.oc-mission-control/config.json`
- **Auto-Migration**: Automatically imports existing `.env.local` settings on first run

### 🤖 Agent Management
- **Real-time Agent Status**: Monitor active and idle agents across all sessions
- **Interactive Chat Interface**: Direct message agents with streaming responses
- **Per-Session Settings**: Configure model, thinking level, verbosity, and reasoning for each agent
- **Agent Selection**: Quick-switch between agents via status bar or mobile command panel

### 🎛️ Advanced Controls
- **Model Override**: Select from 720+ models per session
- **Thinking Levels**: off → minimal → low → medium → high → xhigh
- **Verbose Mode**: Control tool call visibility (off/on/full)
- **Reasoning Display**: Toggle reasoning blocks (off/on/stream)

### 📱 Responsive Design
- **Desktop-Optimized**: Full-featured status bar with all controls
- **Mobile-First**: Dedicated command center overlay for touch interfaces
- **Adaptive UI**: Seamless experience across all screen sizes

### 🔧 Real-Time Features
- **Live Tool Call Visualization**: See tool executions as they happen (amber cards)
- **Reasoning Bubbles**: Watch agent thinking processes unfold (purple gradients)
- **Activity Log**: Track agent actions and events (persisted across restarts)
- **WebSocket Communication**: Low-latency bidirectional updates

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v18 or higher
- **OpenClaw Gateway**: Running instance (local or remote)
- **Gateway Token**: Obtain from your OpenClaw Gateway configuration

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/openclaw-mc.git
cd openclaw-mc

# Install dependencies
npm install

# Configure your gateway (optional - can be done via UI)
cp .env.local.example .env.local
# Edit .env.local with your gateway details
```

### Configuration

#### Option 1: Environment Variables (Auto-Migrated)

Create `.env.local`:

```env
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your_gateway_token_here
```

On first run, these settings will be automatically imported to `~/.oc-mission-control/config.json`.

#### Option 2: UI Setup (Recommended)

1. Start Mission Control without `.env.local`
2. The Gateway Setup screen will appear automatically
3. Enter your gateway details:
   - **Name**: A friendly name (e.g., "Production Cluster")
   - **WebSocket URL**: `ws://your-gateway-host:18789`
   - **Token**: Your OpenClaw Gateway token
4. Click "Initialize Link"

### Running

#### Development Mode

```bash
npm run dev
# or
node server.js
```

Mission Control will be available at:
- **Local**: http://localhost:3000
- **Network**: http://0.0.0.0:3000 (accessible from other devices)

#### Production Mode

```bash
npm run build
npm start
```

### Reverse Proxy Setup (Optional)

For secure remote access via HTTPS:

**Nginx:**

```nginx
location /mission-control/ {
    proxy_pass http://localhost:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Caddy:**

```caddy
mission-control.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## 🔧 Configuration Details

### Gateway Configuration File

**Location**: `~/.oc-mission-control/config.json`

**Structure**:

```json
{
  "gateways": [
    {
      "id": "uuid-v4-string",
      "name": "Local Gateway",
      "url": "ws://127.0.0.1:18789",
      "token": "your_token_here",
      "isLocal": true
    },
    {
      "id": "uuid-v4-string",
      "name": "Production Server",
      "url": "wss://gateway.example.com:18789",
      "token": "remote_token_here",
      "isLocal": false
    }
  ],
  "activeGatewayId": "uuid-of-active-gateway"
}
```

**Fields**:
- `id`: Unique identifier (auto-generated)
- `name`: Display name for the gateway
- `url`: WebSocket URL (ws:// or wss://)
- `token`: Authentication token
- `isLocal`: Flag to prevent deletion of local gateway
- `activeGatewayId`: Currently active gateway

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENCLAW_GATEWAY_URL` | Gateway HTTP URL (auto-converted to ws://) | `http://127.0.0.1:18789` | No* |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway authentication token | - | No* |
| `PORT` | Server listening port | `3000` | No |
| `NODE_ENV` | Runtime environment | `development` | No |

\* Required only if not using UI setup or existing config.json

### Activity Log

**Location**: `mission-control/data/activity-history.json`

Stores up to 500 recent agent activities (tool calls, chat events) for persistence across restarts.

---

## 🎯 Usage Guide

### Adding a Remote Gateway

**Desktop**:
1. Click the "Connected" dropdown in the bottom-right status bar
2. Select "Connect Remote Gateway"
3. Fill in the gateway details
4. Click "Initialize Link"

**Mobile**:
1. Open the Command Panel (grid icon in top-right)
2. Scroll to "Gateway Connection" section
3. Tap "Add Remote Gateway"
4. Complete the setup form

### Switching Gateways

**Desktop**: Click the gateway dropdown in the status bar and select a different gateway.

**Mobile**: Open Command Panel → Gateway Connection → Tap the gateway you want to activate.

The connection will re-establish automatically. Agent list and sessions will update.

### Removing a Gateway

**Desktop**: Open the gateway dropdown → Click the trash icon next to the gateway.

**Mobile**: Gateway Connection section → Tap the trash icon.

**Note**: Local gateways (imported from `.env.local`) cannot be removed via UI.

### Configuring Agent Sessions

Select an agent from the status bar or command panel, then adjust:

- **Model**: Choose from available models (synced from gateway)
- **Thinking**: Control reasoning depth (off → xhigh)
- **Verbose**: Toggle tool call visibility (off/on/full)
- **Reasoning**: Show/hide reasoning blocks (off/on/stream)

Settings persist and apply immediately to the active session.

---

## 🏗️ Architecture

### Tech Stack

- **Framework**: Next.js 15 (React 19 RC)
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives
- **Real-Time**: WebSocket (native `ws` library)
- **Server**: Custom Node.js server with Next.js handler

### Key Components

```
mission-control/
├── server.js                 # Custom Node.js server + Gateway connection manager
├── app/
│   └── page.tsx             # Main application (chat, setup routing)
├── components/
│   ├── agents/              # Agent selection UI
│   ├── chat/                # Chat interface, messages, streaming
│   ├── gateway/             # Gateway setup + switcher
│   ├── layout/              # StatusBar, headers
│   ├── mobile/              # MobileControlPanel
│   └── statusbar/           # Model/Thinking/Verbose/Reasoning toggles
├── hooks/
│   ├── useGatewayWebSocket.ts  # WebSocket connection manager
│   ├── useAgentEvents.ts       # Chat/tool/reasoning event handler
│   └── useSessionSettings.ts   # Session configuration manager
├── types/                   # TypeScript definitions
└── data/                    # Persistent activity log
```

### Communication Flow

```
┌──────────────────┐      WebSocket       ┌──────────────────┐
│  Frontend (UI)   │ ◄─────────────────► │  server.js       │
│  (Next.js App)   │   JSON-RPC Messages  │  (Node Backend)  │
└──────────────────┘                      └──────────────────┘
                                                   │
                                                   │ WebSocket
                                                   ▼
                                          ┌──────────────────┐
                                          │ OpenClaw Gateway │
                                          │  (ws://...)      │
                                          └──────────────────┘
```

**Message Types**:
- `gateways.list` / `gateways.add` / `gateways.switch` / `gateways.remove`
- `agents` / `sessions.list` / `sessions.patch`
- `models.list` / `chat.send`
- `event` (agent, chat, tool, reasoning streams)

---

## 🐛 Troubleshooting

### "No Gateway" Screen on Startup

**Cause**: No gateway configured in `~/.oc-mission-control/config.json` or `.env.local`.

**Solution**: Use the UI setup screen to add your first gateway, or create `.env.local` with gateway credentials.

### WebSocket Connection Fails

**Symptoms**: "Disconnected" status, no agents visible.

**Checks**:
1. Verify OpenClaw Gateway is running: `openclaw gateway status`
2. Test gateway URL: `curl http://localhost:18789/health` (should return gateway info)
3. Check token: Ensure `OPENCLAW_GATEWAY_TOKEN` matches gateway config
4. Firewall: Allow port 18789 (or your custom gateway port)

### Gateway Switching Doesn't Work

**Cause**: Old WebSocket connection not closing cleanly.

**Solution**: Restart Mission Control server:
```bash
pkill -f "node server.js"
npm run dev
```

### Agents Not Appearing

**Cause**: Gateway authenticated but agents.list failed.

**Solution**: Check gateway logs for errors. Ensure the operator token has `operator.read` scope.

### Tool Calls Not Displaying

**Cause**: `verboseLevel` set to `off`.

**Solution**: Select an agent → Set "Verbose" toggle to `on` or `full` in the status bar.

---

## 🔐 Security Notes

- **Tokens**: Never commit `.env.local` or `config.json` to version control.
- **HTTPS**: Use a reverse proxy (Nginx/Caddy) with SSL for production deployments.
- **Network Exposure**: Bind to `127.0.0.1` instead of `0.0.0.0` if not accessing remotely.
- **Gateway Access**: Use OpenClaw's built-in authentication and scopes (`operator.*`).

---

## 📝 Development

### Project Scripts

```bash
npm run dev       # Start development server (hot reload)
npm run build     # Build for production
npm start         # Run production build
npm run lint      # Run ESLint
```

### Adding Features

1. **New Gateway RPC**: Add handler in `server.js` WebSocket `message` event
2. **New UI Component**: Follow Radix UI + Tailwind patterns in `components/`
3. **State Management**: Use React hooks (`useState`, `useCallback`, `useRef`)
4. **Styling**: Tailwind utility classes (see `tailwind.config.js` for theme)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

MIT License - see LICENSE file for details.

---

## 📚 Documentation

Additional documentation is available in the [`docs/`](./docs) folder:

- [**STREAMING-GUIDE.md**](./docs/STREAMING-GUIDE.md) - WebSocket streaming implementation details
- [**WEBSOCKET.md**](./docs/WEBSOCKET.md) - WebSocket architecture and message protocol
- [**STATUS-BAR-ENHANCEMENTS.md**](./docs/STATUS-BAR-ENHANCEMENTS.md) - Status bar features and controls
- [**IMPLEMENTATION-COMPLETE.md**](./docs/IMPLEMENTATION-COMPLETE.md) - Implementation notes
- [**REFACTOR-SUMMARY.md**](./docs/REFACTOR-SUMMARY.md) - Code refactoring summary
- [**FIXES-APPLIED.md**](./docs/FIXES-APPLIED.md) - Bug fixes and improvements
- [**STATUS-BAR-COMPLETE.md**](./docs/STATUS-BAR-COMPLETE.md) - Status bar completion notes

---

## 🐳 Docker Deployment

Mission Control can be deployed using Docker for easy setup and portability.

### Quick Start with Docker

```bash
# Build the Docker image
make docker-build

# Start with docker-compose
make docker-up

# View logs
make docker-logs

# Stop containers
make docker-down
```

### Manual Docker Commands

```bash
# Build the image
docker build -t mission-control:latest .

# Run the container
docker run -d \
  -p 3000:3000 \
  -v ~/.oc-mission-control:/root/.oc-mission-control \
  -e OPENCLAW_GATEWAY_URL=http://host.docker.internal:18789 \
  -e OPENCLAW_GATEWAY_TOKEN=your_token_here \
  --name mission-control \
  mission-control:latest

# Or use docker-compose
docker-compose up -d
```

### Configuration for Docker

Create a `.env.local` file or use the mounted config volume at `~/.oc-mission-control`.

See `.env.local.example` for available environment variables.

---

## 🔗 Links

- **OpenClaw Docs**: https://docs.openclaw.ai
- **OpenClaw GitHub**: https://github.com/openclaw/openclaw
- **ClawHub (Skills)**: https://clawhub.com
- **Discord Community**: https://discord.com/invite/clawd

---

## 📸 Screenshots

### Desktop Interface
![Desktop View](docs/screenshots/desktop.png)

### Mobile Command Panel
![Mobile View](docs/screenshots/mobile.png)

### Gateway Setup
![Setup Screen](docs/screenshots/setup.png)

---

**Built with ❤️ for the OpenClaw ecosystem**
