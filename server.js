import { WebSocketServer } from 'ws'
import http from 'http'
import * as map from 'lib0/map'

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

const pingTimeout = 30000
const port = process.env.PORT || 4444

// C1: CORS allowlist from env (default: localhost dev server)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

// C2: Topic name regex — must match er-diagram-{roomId}-{token} format
const TOPIC_REGEX = /^er-diagram-[a-z0-9]{12,}-[a-z0-9]{12,}$/

// M4: Rate limiting constants
const MAX_MESSAGES_PER_MINUTE = 100
const MAX_TOPICS_PER_CONNECTION = 5
const MAX_MESSAGE_SIZE = 64 * 1024 // 64 KB

const server = http.createServer((req, res) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('y-webrtc signaling server')
})

const wss = new WebSocketServer({ noServer: true })

/** @type {Map<string, Set<any>>} */
const topics = new Map()

const send = (conn, message) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    conn.close()
    return
  }
  try {
    conn.send(JSON.stringify(message))
  } catch (e) {
    conn.close()
  }
}

const onconnection = (conn, req) => {
  // C1: Verify WebSocket origin against allowlist
  const origin = req.headers.origin
  if (origin && !allowedOrigins.includes(origin)) {
    conn.close(4403, 'Origin not allowed')
    return
  }

  const subscribedTopics = new Set()
  let closed = false
  let pongReceived = true

  // M4: Per-connection rate limiting
  let messageCount = 0
  let messageWindowStart = Date.now()

  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close()
      clearInterval(pingInterval)
    } else {
      pongReceived = false
      try { conn.ping() } catch (e) { conn.close() }
    }
  }, pingTimeout)

  conn.on('pong', () => { pongReceived = true })

  conn.on('close', () => {
    subscribedTopics.forEach(topicName => {
      const subs = topics.get(topicName) || new Set()
      subs.delete(conn)
      if (subs.size === 0) topics.delete(topicName)
    })
    subscribedTopics.clear()
    closed = true
    clearInterval(pingInterval)
  })

  conn.on('message', raw => {
    // M4: Message size check
    const size = typeof raw === 'string' ? raw.length : raw.byteLength || 0
    if (size > MAX_MESSAGE_SIZE) {
      conn.close(4413, 'Message too large')
      return
    }

    // M4: Rate limiting — max messages per minute
    const now = Date.now()
    if (now - messageWindowStart > 60000) {
      messageCount = 0
      messageWindowStart = now
    }
    messageCount++
    if (messageCount > MAX_MESSAGES_PER_MINUTE) {
      conn.close(4429, 'Rate limit exceeded')
      return
    }

    let message
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString())
    } catch {
      return
    }

    if (message && message.type && !closed) {
      switch (message.type) {
        case 'subscribe':
          (message.topics || []).forEach(topicName => {
            if (typeof topicName !== 'string') return

            // C2: Validate topic name format
            if (!TOPIC_REGEX.test(topicName)) return

            // M4: Max topics per connection
            if (subscribedTopics.size >= MAX_TOPICS_PER_CONNECTION) return

            const topic = map.setIfUndefined(topics, topicName, () => new Set())
            topic.add(conn)
            subscribedTopics.add(topicName)
          })
          break
        case 'unsubscribe':
          (message.topics || []).forEach(topicName => {
            const subs = topics.get(topicName)
            if (subs) subs.delete(conn)
          })
          break
        case 'publish':
          if (message.topic) {
            const receivers = topics.get(message.topic)
            if (receivers) {
              message.clients = receivers.size
              receivers.forEach(receiver => send(receiver, message))
            }
          }
          break
        case 'ping':
          send(conn, { type: 'pong' })
          break
      }
    }
  })
}

wss.on('connection', onconnection)

server.on('upgrade', (request, socket, head) => {
  // C1: Check origin on upgrade
  const origin = request.headers.origin
  if (origin && !allowedOrigins.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port, () => {
  console.log(`Signaling server running on port ${port}`)
})
