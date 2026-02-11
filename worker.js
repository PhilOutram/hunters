// Cloudflare Workers Backend for Hunter vs Hunted Game
// Deploy this to Cloudflare Workers (workers.cloudflare.com)

// CONFIGURATION
const CONFIG = {
  // Data retention: Auto-delete positions older than 15 minutes
  MAX_POSITION_AGE: 15 * 60 * 1000,
  
  // Rate limiting: Max requests per IP per minute
  RATE_LIMIT: 60,
  
  // CORS allowed origins (update for production)
  ALLOWED_ORIGINS: [
    'https://philoutram.github.io', // Replace with your GitHub Pages URL
  ],
};

// In-memory storage (Workers KV would be better for production)
// For this simple use case, we'll use the Workers runtime global
let gameData = new Map(); // gameCode -> Map of playerId -> playerData

// Rate limiting map
let rateLimitMap = new Map(); // IP -> { count, resetTime }

// Helper Functions
function getCorsHeaders(origin) {
  const allowedOrigin = CONFIG.ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : CONFIG.ALLOWED_ORIGINS[0];
    
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

function checkRateLimit(ip) {
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  const limit = rateLimitMap.get(ip);
  
  // Reset if time window passed
  if (now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  // Check limit
  if (limit.count >= CONFIG.RATE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

function cleanOldData() {
  const now = Date.now();
  const cutoff = now - CONFIG.MAX_POSITION_AGE;
  
  // Clean up old games and positions
  for (const [gameCode, players] of gameData.entries()) {
    for (const [playerId, playerData] of players.entries()) {
      if (playerData.timestamp < cutoff) {
        players.delete(playerId);
      }
    }
    
    // Remove empty games
    if (players.size === 0) {
      gameData.delete(gameCode);
    }
  }
  
  // Clean up old rate limit entries
  for (const [ip, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

// API Handlers
async function handleUpdateLocation(request, origin) {
  try {
    const data = await request.json();
    
    // Validate required fields
    const required = ['playerId', 'playerName', 'role', 'gameCode', 'lat', 'lon', 'timestamp'];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        return jsonResponse(
          { error: `Missing required field: ${field}` },
          400,
          origin
        );
      }
    }
    
    // Validate data types and ranges
    if (typeof data.lat !== 'number' || data.lat < -90 || data.lat > 90) {
      return jsonResponse({ error: 'Invalid latitude' }, 400, origin);
    }
    
    if (typeof data.lon !== 'number' || data.lon < -180 || data.lon > 180) {
      return jsonResponse({ error: 'Invalid longitude' }, 400, origin);
    }
    
    if (!['hunter', 'hunted'].includes(data.role)) {
      return jsonResponse({ error: 'Invalid role' }, 400, origin);
    }
    
    // Sanitize inputs
    const gameCode = String(data.gameCode).toUpperCase().slice(0, 10);
    const playerId = String(data.playerId).slice(0, 50);
    const playerName = String(data.playerName).slice(0, 20);
    
    // Get or create game
    if (!gameData.has(gameCode)) {
      gameData.set(gameCode, new Map());
    }
    
    const game = gameData.get(gameCode);
    
    // Store player data
    game.set(playerId, {
      playerId,
      playerName,
      role: data.role,
      gameCode,
      lat: data.lat,
      lon: data.lon,
      accuracy: data.accuracy || 0,
      timestamp: data.timestamp,
    });
    
    return jsonResponse({
      success: true,
      message: 'Location updated',
      playerCount: game.size,
    }, 200, origin);
    
  } catch (error) {
    console.error('Error in handleUpdateLocation:', error);
    return jsonResponse(
      { error: 'Invalid request data' },
      400,
      origin
    );
  }
}

async function handleGetLocations(request, origin) {
  try {
    const url = new URL(request.url);
    const gameCode = url.searchParams.get('gameCode');
    
    if (!gameCode) {
      return jsonResponse({ error: 'Missing gameCode parameter' }, 400, origin);
    }
    
    const sanitizedGameCode = String(gameCode).toUpperCase().slice(0, 10);
    
    // Get game data
    const game = gameData.get(sanitizedGameCode);
    
    if (!game) {
      return jsonResponse({
        locations: [],
        count: 0,
      }, 200, origin);
    }
    
    // Convert Map to array
    const locations = Array.from(game.values());
    
    return jsonResponse({
      locations,
      count: locations.length,
    }, 200, origin);
    
  } catch (error) {
    console.error('Error in handleGetLocations:', error);
    return jsonResponse(
      { error: 'Internal server error' },
      500,
      origin
    );
  }
}

function handleOptions(origin) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

function handleNotFound(origin) {
  return jsonResponse(
    { error: 'Endpoint not found' },
    404,
    origin
  );
}

// Main request handler
async function handleRequest(request) {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions(origin);
  }
  
  // Get client IP for rate limiting
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  // Check rate limit
  if (!checkRateLimit(ip)) {
    return jsonResponse(
      { error: 'Rate limit exceeded. Please try again later.' },
      429,
      origin
    );
  }
  
  // Clean old data periodically (every request is fine for low traffic)
  cleanOldData();
  
  // Route requests
  if (path === '/updateLocation' && request.method === 'POST') {
    return handleUpdateLocation(request, origin);
  }
  
  if (path === '/locations' && request.method === 'GET') {
    return handleGetLocations(request, origin);
  }
  
  if (path === '/' || path === '/health') {
    return jsonResponse({
      status: 'ok',
      message: 'Hunter vs Hunted API',
      version: '1.0.0',
      activeGames: gameData.size,
    }, 200, origin);
  }
  
  return handleNotFound(origin);
}

// Cloudflare Workers entry point
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Alternative export for newer Workers syntax
export default {
  async fetch(request) {
    return handleRequest(request);
  },
};
