# Alternative Backend Configurations

This file contains ready-to-use configurations for different serverless platforms if you prefer not to use Cloudflare Workers.

---

## 🔷 Netlify Functions

### File Structure
```
netlify/
└── functions/
    ├── updateLocation.js
    └── locations.js
```

### netlify.toml
```toml
[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### netlify/functions/updateLocation.js
```javascript
// Simple in-memory storage (doesn't persist between cold starts)
// For production, use external database like Firebase or Supabase

let gameData = {};

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Validate
    if (!data.playerId || !data.gameCode || !data.lat || !data.lon) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const gameCode = data.gameCode.toUpperCase();
    
    // Initialize game if needed
    if (!gameData[gameCode]) {
      gameData[gameCode] = {};
    }
    
    // Store player data
    gameData[gameCode][data.playerId] = {
      playerId: data.playerId,
      playerName: data.playerName,
      role: data.role,
      gameCode: gameCode,
      lat: data.lat,
      lon: data.lon,
      accuracy: data.accuracy || 0,
      timestamp: data.timestamp || Date.now(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        playerCount: Object.keys(gameData[gameCode]).length,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

### netlify/functions/locations.js
```javascript
// Note: Shared state between functions doesn't work reliably in serverless
// This is a simplified version - use a database for production

let gameData = {};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const gameCode = event.queryStringParameters?.gameCode?.toUpperCase();
    
    if (!gameCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing gameCode parameter' }),
      };
    }

    const game = gameData[gameCode] || {};
    const locations = Object.values(game);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        locations,
        count: locations.length,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

---

## 🟠 AWS Lambda + API Gateway

### serverless.yml (using Serverless Framework)
```yaml
service: hunter-hunted-api

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  memorySize: 128
  timeout: 10

functions:
  updateLocation:
    handler: handler.updateLocation
    events:
      - http:
          path: updateLocation
          method: post
          cors: true

  getLocations:
    handler: handler.getLocations
    events:
      - http:
          path: locations
          method: get
          cors: true
```

### handler.js
```javascript
// AWS Lambda handler
// Note: Use DynamoDB or ElastiCache for persistent storage

const gameData = new Map();

// Helper function for responses
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

module.exports.updateLocation = async (event) => {
  try {
    const data = JSON.parse(event.body);
    
    if (!data.playerId || !data.gameCode) {
      return response(400, { error: 'Missing required fields' });
    }

    const gameCode = data.gameCode.toUpperCase();
    
    if (!gameData.has(gameCode)) {
      gameData.set(gameCode, new Map());
    }
    
    const game = gameData.get(gameCode);
    game.set(data.playerId, data);

    return response(200, {
      success: true,
      playerCount: game.size,
    });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};

module.exports.getLocations = async (event) => {
  try {
    const gameCode = event.queryStringParameters?.gameCode?.toUpperCase();
    
    if (!gameCode) {
      return response(400, { error: 'Missing gameCode parameter' });
    }

    const game = gameData.get(gameCode);
    const locations = game ? Array.from(game.values()) : [];

    return response(200, {
      locations,
      count: locations.length,
    });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error' });
  }
};
```

### Deploy to AWS
```bash
# Install Serverless Framework
npm install -g serverless

# Configure AWS credentials
serverless config credentials --provider aws --key YOUR_KEY --secret YOUR_SECRET

# Deploy
serverless deploy
```

---

## 🟦 Vercel Serverless Functions

### File Structure
```
api/
├── updateLocation.js
└── locations.js
```

### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ]
}
```

### api/updateLocation.js
```javascript
// Vercel Serverless Function
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    
    // Note: Vercel functions are stateless
    // Use Vercel KV or external database for persistence
    
    // For demo purposes, just acknowledge receipt
    return res.status(200).json({
      success: true,
      message: 'Location received (ephemeral storage)',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### api/locations.js
```javascript
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gameCode } = req.query;
    
    // Note: Would need Vercel KV or database here
    
    return res.status(200).json({
      locations: [],
      count: 0,
      message: 'Use Vercel KV for persistence',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

---

## 🔥 Firebase Cloud Functions

### File Structure
```
functions/
├── index.js
└── package.json
```

### functions/package.json
```json
{
  "name": "hunter-hunted-functions",
  "engines": {
    "node": "18"
  },
  "dependencies": {
    "firebase-admin": "^11.0.0",
    "firebase-functions": "^4.0.0"
  }
}
```

### functions/index.js
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// CORS middleware
const cors = require('cors')({ origin: true });

exports.updateLocation = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const data = req.body;
      
      // Store in Firestore
      await db.collection('games')
        .doc(data.gameCode)
        .collection('players')
        .doc(data.playerId)
        .set({
          ...data,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      const snapshot = await db.collection('games')
        .doc(data.gameCode)
        .collection('players')
        .get();

      return res.status(200).json({
        success: true,
        playerCount: snapshot.size,
      });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});

exports.getLocations = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const gameCode = req.query.gameCode;
      
      if (!gameCode) {
        return res.status(400).json({ error: 'Missing gameCode' });
      }

      const snapshot = await db.collection('games')
        .doc(gameCode)
        .collection('players')
        .get();

      const locations = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        locations.push({
          ...data,
          timestamp: data.timestamp?.toMillis() || Date.now(),
        });
      });

      return res.status(200).json({
        locations,
        count: locations.length,
      });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});
```

### Deploy to Firebase
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init functions

# Deploy
firebase deploy --only functions
```

---

## 📊 Comparison Table

| Platform | Free Tier | Setup Difficulty | State Management | Best For |
|----------|-----------|------------------|------------------|----------|
| **Cloudflare Workers** | 100k req/day | ⭐ Easy | In-memory (good) | Recommended ✅ |
| **Netlify** | 125k req/month | ⭐⭐ Medium | Poor (needs DB) | Static sites |
| **AWS Lambda** | 1M req/month | ⭐⭐⭐ Hard | Needs DynamoDB | Enterprise |
| **Vercel** | 100GB-hrs/month | ⭐⭐ Medium | Needs KV/DB | Next.js apps |
| **Firebase** | 125k/day invocations | ⭐⭐ Medium | Firestore (best) | Mobile apps |

---

## 🎯 Recommendation

**For this project, use Cloudflare Workers** because:

1. ✅ Free tier is generous (100k requests/day)
2. ✅ In-memory storage works well for short sessions
3. ✅ Global edge network (low latency)
4. ✅ Simple deployment process
5. ✅ No cold start issues
6. ✅ Built-in rate limiting

**Alternative for production**: Firebase Cloud Functions + Firestore for persistent game history.

---

## 🔄 Migration Guide

To switch backends, you only need to:

1. Deploy new backend using configs above
2. Update `BACKEND_URL` in `app.js`
3. Update CORS origins in backend config
4. Redeploy frontend

The frontend code works with any backend that implements the two endpoints:
- `POST /updateLocation`
- `GET /locations`

---

## 💾 Adding Persistent Storage

For production with game history/leaderboards, add a database:

### Option 1: Firebase Firestore (easiest)
```javascript
// In worker.js or cloud function
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = { /* your config */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Store location
await addDoc(collection(db, 'locations'), {
  playerId: data.playerId,
  lat: data.lat,
  lon: data.lon,
  timestamp: serverTimestamp(),
});
```

### Option 2: Supabase (PostgreSQL)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Store location
await supabase.from('locations').insert({
  player_id: data.playerId,
  lat: data.lat,
  lon: data.lon,
  timestamp: new Date(),
});
```

### Option 3: Cloudflare Workers KV
```javascript
// In worker.js
export default {
  async fetch(request, env) {
    // Store in KV
    await env.GAME_DATA.put(
      `game:${gameCode}:${playerId}`,
      JSON.stringify(locationData),
      { expirationTtl: 900 } // 15 minutes
    );
    
    // Retrieve from KV
    const stored = await env.GAME_DATA.get(`game:${gameCode}:${playerId}`);
    const data = JSON.parse(stored);
  }
};
```

---

**Choose the platform that best fits your needs!** For beginners, stick with Cloudflare Workers.
