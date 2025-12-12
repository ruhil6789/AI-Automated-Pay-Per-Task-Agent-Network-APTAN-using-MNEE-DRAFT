# Real-Time Updates Guide

APTAN now supports **multiple methods** for getting data and receiving updates in the frontend:

## Available Methods

### 1. **WebSocket (Primary - Recommended)**
Real-time bidirectional communication using Socket.IO.

**Backend:**
- WebSocket server runs on the same port as the HTTP server
- Emits `taskUpdate` events when tasks are created, completed, or updated
- Supports task-specific rooms for targeted updates

**Frontend:**
- Automatically connects when viewing a task detail page
- Joins task-specific room for targeted updates
- Receives instant updates without polling

**Events Emitted:**
- `taskUpdate` - When any task is updated
- `taskCompleted` - When a task is completed
- `taskCreated` - When a new task is created

**Example:**
```javascript
// Automatically handled in TaskDetail.js
socket.on('taskUpdate', (data) => {
  // Update UI immediately
});
```

### 2. **Server-Sent Events (SSE) - Alternative**
One-way real-time updates from server to client.

**Endpoint:** `GET /api/tasks/:id/events`

**Features:**
- Simpler than WebSocket (one-way only)
- Works with HTTP/2
- Automatic reconnection
- Fallback option if WebSocket fails

**Example:**
```javascript
const eventSource = new EventSource(`http://localhost:3001/api/tasks/${taskId}/events`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Update UI
};
```

### 3. **HTTP Polling (Fallback)**
Traditional REST API polling as a fallback.

**Endpoint:** `GET /api/tasks/:id`

**Features:**
- Works everywhere
- No special setup required
- Used as fallback if WebSocket/SSE fail
- Polls every 10 seconds (longer interval since real-time updates are primary)

### 4. **Direct Blockchain Reads**
Direct contract interaction via MetaMask/Ethers.js.

**Features:**
- No backend required
- Always up-to-date from blockchain
- Used when backend is unavailable
- Slower but reliable

## Implementation Details

### Backend WebSocket Setup

```javascript
// server.js
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Emit updates
emitTaskUpdate(taskId, {
  completed: true,
  solution: "...",
  // ... other fields
});
```

### Frontend WebSocket Setup

```javascript
// TaskDetail.js
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  socket.emit('joinTask', taskId);
});

socket.on('taskUpdate', (data) => {
  // Update state immediately
  setTask(prev => ({ ...prev, ...data }));
});
```

## When Updates Are Sent

1. **Task Created:**
   - When synced from blockchain
   - When saved from frontend

2. **Task Completed:**
   - When AI agent submits solution
   - When manual retry succeeds

3. **Task Error:**
   - When transaction fails
   - When solution generation fails

4. **Task Retry:**
   - When manual retry is triggered
   - When automatic retry succeeds

## Benefits

✅ **Instant Updates** - No need to refresh or wait for polling
✅ **Reduced Server Load** - No constant HTTP requests
✅ **Better UX** - Users see updates immediately
✅ **Multiple Fallbacks** - WebSocket → SSE → Polling → Blockchain
✅ **Task-Specific Updates** - Only receive updates for tasks you're viewing

## Configuration

Set `FRONTEND_URL` in backend `.env` to configure CORS:
```
FRONTEND_URL=http://localhost:3000
```

## Troubleshooting

**WebSocket not connecting:**
- Check CORS settings
- Verify backend is running
- Check browser console for errors

**Updates not received:**
- Verify task ID matches
- Check WebSocket connection status
- Fallback to polling will activate automatically

**SSE not working:**
- Some browsers have limitations
- WebSocket is preferred
- SSE is automatic fallback

