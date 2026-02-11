# 🚀 QUICK START GUIDE

## Get Your Game Running in 10 Minutes!

### Step 1: Deploy Backend (5 minutes)

1. **Go to Cloudflare Workers**: https://workers.cloudflare.com
2. **Sign up** for free account
3. **Create Worker**:
   - Click "Create Application"
   - Click "Create Worker"
   - Name it: `hunter-hunted-api`
4. **Paste Code**:
   - Click "Edit Code"
   - Delete default code
   - Copy ALL of `worker.js` content
   - Paste it in
   - Click "Save and Deploy"
5. **Copy URL**: You'll get something like:
   ```
   https://hunter-hunted-api.YOUR-NAME.workers.dev
   ```
   **SAVE THIS URL!**

### Step 2: Update Frontend (2 minutes)

1. **Edit `app.js`**:
   - Open `app.js` in text editor
   - Line 2, change:
   ```javascript
   BACKEND_URL: 'https://your-backend-url.workers.dev',
   ```
   to:
   ```javascript
   BACKEND_URL: 'https://hunter-hunted-api.YOUR-NAME.workers.dev',
   ```
   - Save file

### Step 3: Deploy to GitHub Pages (3 minutes)

1. **Create GitHub repo**:
   - Go to https://github.com/new
   - Name: `hunter-vs-hunted`
   - Click "Create repository"

2. **Upload files**:
   - Click "uploading an existing file"
   - Drag these files:
     - `index.html`
     - `styles.css`
     - `app.js`
   - Click "Commit changes"

3. **Enable GitHub Pages**:
   - Go to repo Settings
   - Click "Pages" (sidebar)
   - Source: "main" branch
   - Click Save
   - Wait 1-2 minutes

4. **Get URL**: Your game will be at:
   ```
   https://YOUR-USERNAME.github.io/hunter-vs-hunted/
   ```

### Step 4: Update CORS (1 minute)

1. **Edit Worker again**:
   - Go back to Cloudflare Workers
   - Edit your worker
   - Find line ~10:
   ```javascript
   ALLOWED_ORIGINS: [
     'http://localhost:3000',
     'http://127.0.0.1:3000',
     'https://your-username.github.io',  // ← UPDATE THIS!
   ],
   ```
   - Change to your actual GitHub Pages URL:
   ```javascript
   ALLOWED_ORIGINS: [
     'https://YOUR-USERNAME.github.io',
   ],
   ```
   - Save and Deploy

### Step 5: Play! 🎮

1. **Open on mobile**: `https://YOUR-USERNAME.github.io/hunter-vs-hunted/`
2. **Allow location** when prompted
3. **Enter**:
   - Your name
   - Game code (e.g., "ALPHA")
   - Role (Hunter or Hunted)
4. **Start game**
5. **Get friends** to join with same game code!

---

## 🧪 Testing Alone

You can test with one device:

1. Create game as "Hunter"
2. Walk around for 2+ minutes
3. You'll see your trail (delayed)

Or use two devices (phone + tablet).

---

## ⚠️ Important Notes

- **HTTPS required** (GitHub Pages provides this)
- **GPS takes time** to get accurate (30-60 seconds)
- **Wait 2 minutes** before opponent markers appear
- **Outdoors works best** (GPS signal)
- **Allow location** in browser settings

---

## 🐛 Troubleshooting

### "Failed to update location"
- Check `BACKEND_URL` in `app.js` is correct
- Verify Worker is deployed
- Check CORS origins match your GitHub Pages URL

### "Location permission denied"
- Enable location in browser settings
- Make sure using HTTPS (GitHub Pages does this)
- Try Chrome or Safari

### "No opponent markers"
- Wait FULL 2 minutes after game starts
- Check using same game code
- Verify opposite teams (hunter sees hunted)
- Both players need GPS accuracy < 100m

### "Map not loading"
- Check internet connection
- Clear browser cache
- Try different browser

---

## 📁 File Checklist

Make sure you have these files:

- ✅ `index.html` - Main HTML
- ✅ `styles.css` - Styling
- ✅ `app.js` - Game logic (with YOUR backend URL!)
- ✅ `worker.js` - Backend code (deployed to Cloudflare)
- ✅ `README.md` - Full documentation
- ✅ `DEPLOYMENT_ALTERNATIVES.md` - Other platforms
- ✅ `QUICKSTART.md` - This file

---

## 🎯 Game Rules Reminder

- **Duration**: 10 minutes
- **Delay**: See opponent positions from 2 minutes ago
- **Capture**: Hunters win if within 50m of hunted
- **Survival**: Hunted win if they survive 10 minutes
- **Teams**: 2 hunters vs 2 hunted

---

## 🔗 Useful Links

- **Cloudflare Workers**: https://workers.cloudflare.com
- **GitHub Pages**: https://pages.github.com
- **Test Backend**: `https://YOUR-WORKER-URL/health`
- **Leaflet Docs**: https://leafletjs.com

---

## 📞 Need Help?

1. Read `README.md` for full documentation
2. Check troubleshooting section above
3. Test backend with curl (see README)
4. Verify GPS is enabled on device
5. Try in different location (outdoors)

---

## ✨ Customization

Want to tweak the game? Edit `app.js`:

```javascript
// Line ~4-7
UPDATE_INTERVAL: 5000,     // How often to update (ms)
POSITION_DELAY: 120000,    // 2-minute delay (ms)
GAME_DURATION: 600000,     // 10-minute games (ms)
CAPTURE_DISTANCE: 50,      // 50m to capture (meters)
```

---

**That's it! You now have a working GPS-based mobile game. Have fun! 🎉**

Share your game URL with friends and start hunting!
