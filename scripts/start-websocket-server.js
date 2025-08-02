#!/usr/bin/env node

// WebSocket Server Startup Script
// Starts the WebSocket server for real-time AI processing

const { initializeWebSocketServer } = require('../src/lib/websocket/websocket-server.js');

console.log('🚀 Starting AI WebSocket Server...');

try {
  // Initialize WebSocket server
  const wsServer = initializeWebSocketServer();
  
  console.log('✅ WebSocket server started successfully');
  console.log(`📡 Listening on port ${process.env.WS_PORT || 3001}`);
  console.log('🔌 Ready to accept connections');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wsServer.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wsServer.close();
    process.exit(0);
  });

  // Log connection stats every 30 seconds in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = wsServer.getConnectionStats();
      if (stats.total > 0) {
        console.log(`📊 Active connections: ${stats.total} | Organizations: ${Object.keys(stats.byOrganization).length}`);
      }
    }, 30000);
  }

} catch (error) {
  console.error('❌ Failed to start WebSocket server:', error);
  process.exit(1);
}