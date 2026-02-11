# Hunter vs Hunted - Deployment Guide

A GPS-based mobile game where 2 hunters chase 2 hunted players using real-time location tracking with a 2-minute delay.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Backend Deployment](#backend-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [Testing](#testing)
5. [Architecture](#architecture)
6. [Privacy & Security](#privacy--security)

---

## 🚀 Quick Start

### Prerequisites

- GitHub account (for frontend hosting)
- Cloudflare account (for backend) - **FREE TIER IS SUFFICIENT**
- Modern mobile browser with GPS capability
- HTTPS is required for GPS access

### File Structure

```
hunter-vs-hunted/
├── index.html          # Main HTML file
├── styles.css          # All CSS styling
├── app.js             # Frontend JavaScript
├── worker.js          # Backend (Cloudflare Workers)
└── README.md          # This file
```

---

## 🔧 Backend Deployment

### Option 1: Cloudflare Workers (Recommended - FREE)

#### Step 1: Create Cloudflare Account
1. Go to [workers.cloudflare.com](https://workers.cloudflare.com)
2. Sign up for a free account
3. Verify your email

#### Step 2: Deploy Worker

**Method A: Cloudflare Dashboard (Easiest)**

1. Log in to Cloudflare dashboard
2. Click "Workers & Pages" in the sidebar
3. Click "Create Application"
4. Select "Create Worker"
5. Give it a name: `hunter-hunted-api`
6. Click "Deploy"
7. Click "Edit Code"
8. Delete the default code
9. Copy the entire contents of `worker.js`
10. Paste into the editor
11. Click "Save and Deploy"

**Method B: Wrangler CLI (Advanced)**

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create a new worker project
mkdir hunter-hunted-backend
cd hunter-hunted-backend

# Copy worker.js to this directory
cp ../worker.js ./worker.js

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "hunter-hunted-api"
main = "worker.js"
compatibility_date = "2024-01-01"
EOF

# Deploy
wrangler deploy
```

#### Step 3: Get Your Worker URL

After deployment, you'll get a URL like:
```
https://hunter-hunted-api.your-subdomain.workers.dev
```

**Save this URL - you'll need it for the frontend!**

#### Step 4: Update CORS Settings (Important!)

Before deploying frontend, you need to update the allowed origins in `worker.js`:

```javascript
// In worker.js, line ~10
ALLOWED_ORIGINS: [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://YOUR-GITHUB-USERNAME.github.io', // ← Update this!
],
```

After updating, redeploy the worker.

---

### Option 2: Netlify Functions (Alternative - FREE)

#### Setup

1. Create account at [netlify.com](https://netlify.com)
2. Create folder structure:

```
netlify/functions/
├── updateLocation.js
└── locations.js
```

3. Convert the worker code to Netlify functions format:

**netlify/functions/updateLocation.js:**
```javascript
const gameData = new Map();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const data = JSON.parse(event.body);
    
    if (!gameData.has(data.gameCode)) {
      gameData.set(data.gameCode, new Map());
    }
    
    const game = gameData.get(data.gameCode);
    game.set(data.playerId, data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, playerCount: game.size }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  }
};
```

**netlify/functions/locations.js:**
```javascript
const gameData = new Map(); // Note: Shared state doesn't work well with serverless

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const gameCode = event.queryStringParameters?.gameCode;
  const game = gameData.get(gameCode);
  
  const locations = game ? Array.from(game.values()) : [];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ locations, count: locations.length }),
  };
};
```

⚠️ **Note:** Netlify Functions don't share state between invocations well. For production, you'd need to use a database (Firebase, Supabase, etc.). Cloudflare Workers is recommended for this use case.

---

### Option 3: AWS Lambda (Alternative)

Similar to Netlify but requires more setup. Use API Gateway + Lambda functions. Not recommended for beginners due to complexity.

---

## 🌐 Frontend Deployment

### GitHub Pages (Recommended - FREE)

#### Step 1: Update Backend URL

1. Open `app.js`
2. Find line ~2:
```javascript
BACKEND_URL: 'https://your-backend-url.workers.dev',
```
3. Replace with your actual Cloudflare Worker URL:
```javascript
BACKEND_URL: 'https://hunter-hunted-api.your-subdomain.workers.dev',
```

#### Step 2: Create GitHub Repository

```bash
# Initialize git repository
git init

# Add files
git add index.html styles.css app.js README.md

# Commit
git commit -m "Initial commit: Hunter vs Hunted game"

# Create repository on GitHub (via web interface)
# Then connect and push:
git remote add origin https://github.com/YOUR-USERNAME/hunter-vs-hunted.git
git branch -M main
git push -u origin main
```

#### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings"
3. Scroll down to "Pages" (in sidebar)
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait 1-2 minutes for deployment

Your game will be available at:
```
https://YOUR-USERNAME.github.io/hunter-vs-hunted/
```

#### Step 4: Update Worker CORS (Final Step!)

Now that you know your GitHub Pages URL, update the Worker's CORS settings:

1. Go back to Cloudflare Workers dashboard
2. Edit your worker code
3. Update `ALLOWED_ORIGINS` to include your GitHub Pages URL:
```javascript
ALLOWED_ORIGINS: [
  'https://YOUR-USERNAME.github.io',
],
```
4. Save and deploy

---

## 🧪 Testing

### Local Testing

#### Test Frontend Locally

```bash
# Simple Python server
python -m http.server 3000

# Or Node.js
npx serve -p 3000
```

Open `http://localhost:3000` in your mobile browser.

⚠️ **GPS requires HTTPS in production!** Local testing with `http://localhost` is allowed, but production must use HTTPS.

#### Test Backend

```bash
# Health check
curl https://your-worker-url.workers.dev/health

# Test update location
curl -X POST https://your-worker-url.workers.dev/updateLocation \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "test_1",
    "playerName": "TestPlayer",
    "role": "hunter",
    "gameCode": "TEST123",
    "lat": 37.7749,
    "lon": -122.4194,
    "accuracy": 10,
    "timestamp": 1234567890000
  }'

# Get locations
curl "https://your-worker-url.workers.dev/locations?gameCode=TEST123"
```

### Mobile Testing

1. Open game URL on mobile device
2. Allow location permissions when prompted
3. Create a game code (e.g., "ALPHA")
4. Enter name and select role
5. Start game
6. Check that:
   - GPS accuracy shows < 100m
   - Map centers on your location
   - Player marker appears

### Multi-Player Testing

1. Open game on 2+ devices
2. Use same game code (e.g., "ALPHA")
3. Assign roles:
   - 1-2 devices as "Hunter"
   - 1-2 devices as "Hunted"
4. Start all games
5. Wait 2 minutes
6. Verify opponent markers appear with 2-minute delay

---

## 🏗️ Architecture

### System Overview

```
┌─────────────┐     GPS      ┌──────────────┐
│   Player 1  │─────every────▶│   Browser    │
│   (Hunter)  │    5 sec      │   (Mobile)   │
└─────────────┘               └──────┬───────┘
                                     │
                                     │ POST /updateLocation
                                     │ GET /locations (every 5s)
                                     ▼
                              ┌──────────────┐
                              │  Cloudflare  │
                              │   Workers    │
                              │   (Backend)  │
                              └──────┬───────┘
                                     │
                                     │ In-Memory Storage
                                     │ (per game code)
                                     ▼
                              ┌──────────────┐
                              │   Game Data  │
                              │   playerId → │
                              │   {lat, lon, │
                              │   timestamp} │
                              └──────────────┘
```

### Data Flow

1. **GPS Polling** (every 5 seconds):
   - Client requests GPS position
   - Browser returns lat/lon/accuracy
   - If accuracy < 100m, accept position

2. **Location Update** (every 5 seconds):
   - Client POSTs position to `/updateLocation`
   - Backend stores: `{playerId, lat, lon, timestamp, role}`
   - Backend returns player count

3. **Fetch Opponents** (every 5 seconds):
   - Client GETs all positions from `/locations`
   - Client filters by:
     - Same game code
     - Opposite team (hunters see hunted, vice versa)
     - At least 2 minutes old
   - Client displays on map

4. **Game End Conditions**:
   - **Hunter Victory**: Within 50m of any hunted player
   - **Hunted Victory**: Survive 10 minutes
   - **Manual**: Player leaves game

### Client-Side Delay Logic

The 2-minute delay is implemented **client-side**:

```javascript
const now = Date.now();
const age = now - player.timestamp;

if (age < 120000) { // 2 minutes
  return; // Don't show yet
}

// Show position from 2+ minutes ago
displayMarker(player);
```

**Why client-side?**
- Simplifies backend (no need to store history)
- Reduces backend storage/costs
- Players can't cheat by modifying timestamps (backend stores server time)

---

## 🔐 Privacy & Security

### Data Privacy

1. **Minimal Data Collection**:
   - Only stores: player ID, name, role, game code, lat/lon, timestamp
   - No persistent storage beyond active games
   - No user accounts or authentication

2. **Data Retention**:
   - Auto-delete positions older than 15 minutes
   - Games auto-expire when empty
   - No long-term storage

3. **Anonymization**:
   - Random player IDs generated client-side
   - No IP addresses stored
   - No device fingerprinting

### Security Measures

1. **Rate Limiting**:
   - Max 60 requests per IP per minute
   - Prevents API abuse

2. **Input Validation**:
   - Sanitize all user inputs
   - Validate lat/lon ranges
   - Limit string lengths

3. **CORS Protection**:
   - Whitelist allowed origins
   - Prevent unauthorized access

4. **GPS Accuracy**:
   - Only accept readings < 100m accuracy
   - Prevents location spoofing (partially)

### Best Practices

1. **HTTPS Only**: GPS requires HTTPS in production
2. **Clear Permissions**: Request location permission explicitly
3. **User Consent**: Inform players about data collection
4. **Secure Transmission**: All API calls over HTTPS
5. **No Persistence**: Data deleted after game ends

### Privacy Policy (Suggested)

Add to your game:

> **Privacy Notice**
> 
> This game collects your GPS location to enable gameplay. Your location is:
> - Shared only with other players in your game
> - Displayed with a 2-minute delay to opponents
> - Automatically deleted after 15 minutes
> - Not stored permanently or sold to third parties
> 
> By playing, you consent to location tracking for game purposes only.

---

## 🐛 Troubleshooting

### Common Issues

#### GPS Not Working

**Problem**: "Location permission denied" or no GPS signal

**Solutions**:
1. Ensure HTTPS (required for GPS)
2. Check browser location permissions
3. Enable device location services
4. Try outdoors for better signal
5. Use Chrome/Safari (best GPS support)

#### Backend Connection Failed

**Problem**: "Failed to update location" error

**Solutions**:
1. Verify backend URL in `app.js` is correct
2. Check Worker is deployed and running
3. Verify CORS origins include your domain
4. Check browser console for errors
5. Test backend with curl (see Testing section)

#### Players Not Appearing

**Problem**: Opponent markers don't show on map

**Solutions**:
1. Wait full 2 minutes after game start
2. Verify using same game code
3. Check opposite teams (hunter sees hunted)
4. Ensure both players have GPS accuracy < 100m
5. Check player count in status bar

#### Map Not Loading

**Problem**: Black screen or map tiles not loading

**Solutions**:
1. Check internet connection
2. Verify Leaflet CDN is accessible
3. Try different tile provider (edit `app.js`)
4. Clear browser cache
5. Check browser console for errors

---

## 🚀 Advanced Configuration

### Customization Options

#### Change Game Duration

In `app.js`, line ~6:
```javascript
GAME_DURATION: 600000, // 10 minutes (in milliseconds)
```

#### Change Position Delay

In `app.js`, line ~5:
```javascript
POSITION_DELAY: 120000, // 2 minutes (in milliseconds)
```

#### Change Capture Distance

In `app.js`, line ~7:
```javascript
CAPTURE_DISTANCE: 50, // 50 meters
```

#### Change Update Frequency

In `app.js`, line ~4:
```javascript
UPDATE_INTERVAL: 5000, // 5 seconds (in milliseconds)
```

⚠️ Lower values = more frequent updates = higher costs and battery drain

#### Change Map Tiles

In `app.js`, around line 200:
```javascript
// Current: OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(gameState.map);

// Alternative: CartoDB Dark Matter (better for night)
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
}).addTo(gameState.map);

// Alternative: Mapbox (requires API key)
L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
  id: 'mapbox/streets-v11',
  accessToken: 'YOUR_MAPBOX_TOKEN',
  maxZoom: 19,
}).addTo(gameState.map);
```

### Production Enhancements

For a production-ready version, consider:

1. **Persistent Storage**: Use Cloudflare Workers KV or Durable Objects
2. **Database**: Add Firebase/Supabase for game history
3. **Authentication**: Add user accounts with Firebase Auth
4. **Analytics**: Track game sessions with Google Analytics
5. **Push Notifications**: Alert hunters when close to hunted
6. **Cheating Prevention**: Server-side location validation
7. **Better UI**: Add sounds, animations, team chat
8. **Spectator Mode**: Allow viewing without playing

---

## 📱 Browser Compatibility

### Supported Browsers

| Browser | Mobile | Desktop | GPS Support |
|---------|--------|---------|-------------|
| Chrome  | ✅ Best | ✅ Yes | ✅ Excellent |
| Safari  | ✅ Good | ✅ Yes | ✅ Good |
| Firefox | ⚠️ OK   | ✅ Yes | ⚠️ Fair |
| Edge    | ⚠️ OK   | ✅ Yes | ✅ Good |
| Samsung | ✅ Good | N/A    | ✅ Good |

**Recommended**: Chrome or Safari on mobile for best GPS performance.

---

## 📄 License

This project is open source and free to use. No attribution required.

---

## 🤝 Contributing

Feel free to fork and improve! Suggested enhancements:

- [ ] Add team chat
- [ ] Implement power-ups (freeze, speed boost)
- [ ] Add game replay/history
- [ ] Create leaderboard
- [ ] Add spectator mode
- [ ] Improve anti-cheat measures
- [ ] Add sound effects
- [ ] Create tutorial mode

---

## ❓ FAQ

**Q: Does this work offline?**  
A: No, requires internet for GPS and backend communication.

**Q: How accurate is the GPS?**  
A: Typically 5-50 meters with clear sky. Buildings reduce accuracy.

**Q: Can I use this indoors?**  
A: GPS works poorly indoors. Try Wi-Fi positioning or go outside.

**Q: How many players can join?**  
A: Currently 4 players per game (2 hunters, 2 hunted). Can be modified.

**Q: Is there a player limit?**  
A: Cloudflare Workers free tier handles ~100k requests/day. Plenty for testing.

**Q: Can hunters see each other?**  
A: No, only opposite teams see each other (with 2-minute delay).

**Q: What happens if someone cheats?**  
A: Current version has minimal anti-cheat. For production, add server-side validation.

**Q: Can I monetize this?**  
A: Yes, it's open source. Add ads or make it a paid app if you want.

---

## 📞 Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review browser console for errors
3. Test backend with curl commands
4. Verify GPS permissions are granted

---

**Happy Hunting! 🏹🦌**
