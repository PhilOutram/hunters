// Configuration
const CONFIG = {
    BACKEND_URL: 'https://hunter-hunted-api.phil-outram.workers.dev/',
    UPDATE_INTERVAL: 5000, // 5 seconds
    POSITION_DELAY: 120000, // 2 minutes in milliseconds
    GAME_DURATION: 600000, // 10 minutes in milliseconds
    CAPTURE_DISTANCE: 50, // 50 meters
    MAX_ACCURACY_THRESHOLD: 100, // Only accept GPS readings with accuracy <= 100m
};

// Game State
const gameState = {
    playerId: null,
    playerName: null,
    playerRole: null,
    gameCode: null,
    isActive: false,
    startTime: null,
    map: null,
    playerMarker: null,
    accuracyCircle: null,
    otherMarkers: {},
    updateInterval: null,
    timerInterval: null,
    lastPosition: null,
    watchId: null,
};

// Utility Functions
function generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatAccuracy(accuracy) {
    if (accuracy < 1000) {
        return `${Math.round(accuracy)}m`;
    }
    return `${(accuracy / 1000).toFixed(1)}km`;
}

// Backend API Functions
async function updateLocation(lat, lon, accuracy) {
    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/updateLocation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerId: gameState.playerId,
                playerName: gameState.playerName,
                role: gameState.playerRole,
                gameCode: gameState.gameCode,
                lat,
                lon,
                accuracy,
                timestamp: Date.now(),
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating location:', error);
        showToast('Failed to update location', 'error');
        return null;
    }
}

async function getLocations() {
    try {
        const response = await fetch(
            `${CONFIG.BACKEND_URL}/locations?gameCode=${gameState.gameCode}`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching locations:', error);
        return null;
    }
}

// GPS Functions
function startGPSTracking() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
    };

    gameState.watchId = navigator.geolocation.watchPosition(
        handlePositionSuccess,
        handlePositionError,
        options
    );
}

function stopGPSTracking() {
    if (gameState.watchId !== null) {
        navigator.geolocation.clearWatch(gameState.watchId);
        gameState.watchId = null;
    }
}

function handlePositionSuccess(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Update accuracy display
    document.getElementById('accuracyDisplay').textContent = formatAccuracy(accuracy);
    
    // Only use accurate readings
    if (accuracy > CONFIG.MAX_ACCURACY_THRESHOLD) {
        console.warn(`GPS accuracy too low: ${accuracy}m`);
        return;
    }
    
    gameState.lastPosition = {
        lat: latitude,
        lon: longitude,
        accuracy,
        timestamp: Date.now(),
    };
    
    // Update map
    updatePlayerMarker(latitude, longitude, accuracy);
}

function handlePositionError(error) {
    let message = 'GPS error';
    
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message = 'Location permission denied';
            break;
        case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable';
            break;
        case error.TIMEOUT:
            message = 'Location request timeout';
            break;
    }
    
    console.error('GPS error:', message, error);
    showToast(message, 'error');
}

// Map Functions
function initMap() {
    gameState.map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
    }).setView([0, 0], 16);

    // Use OpenStreetMap tiles (free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(gameState.map);

    // Add zoom control to bottom right
    L.control.zoom({
        position: 'bottomright'
    }).addTo(gameState.map);
}

function updatePlayerMarker(lat, lon, accuracy) {
    if (!gameState.map) return;
    
    const latlng = [lat, lon];
    
    // Update or create marker
    if (gameState.playerMarker) {
        gameState.playerMarker.setLatLng(latlng);
    } else {
        const icon = L.divIcon({
            className: 'player-marker',
            html: `<div class="player-marker self ${gameState.playerRole}" style="width: 20px; height: 20px;"></div>`,
            iconSize: [20, 20],
        });
        
        gameState.playerMarker = L.marker(latlng, { icon })
            .addTo(gameState.map)
            .bindPopup(`You (${gameState.playerRole})`);
    }
    
    // Update or create accuracy circle
    if (gameState.accuracyCircle) {
        gameState.accuracyCircle.setLatLng(latlng);
        gameState.accuracyCircle.setRadius(accuracy);
    } else {
        gameState.accuracyCircle = L.circle(latlng, {
            radius: accuracy,
            color: gameState.playerRole === 'hunter' ? '#e63946' : '#2a9d8f',
            fillColor: gameState.playerRole === 'hunter' ? '#e63946' : '#2a9d8f',
            fillOpacity: 0.15,
            weight: 2,
        }).addTo(gameState.map);
    }
    
    // Center map on first position
    if (!gameState.startTime || Date.now() - gameState.startTime < 1000) {
        gameState.map.setView(latlng, 16);
    }
}

function updateOtherPlayers(locations) {
    if (!gameState.map || !locations) return;
    
    const now = Date.now();
    const currentPlayerIds = new Set();
    
    // Filter and display opponent positions (with 2-minute delay)
    locations.forEach(player => {
        // Skip self
        if (player.playerId === gameState.playerId) return;
        
        // Skip same team (hunters only see hunted and vice versa)
        const isOpponent = 
            (gameState.playerRole === 'hunter' && player.role === 'hunted') ||
            (gameState.playerRole === 'hunted' && player.role === 'hunter');
        
        if (!isOpponent) return;
        
        currentPlayerIds.add(player.playerId);
        
        // Apply 2-minute delay
        const age = now - player.timestamp;
        if (age < CONFIG.POSITION_DELAY) {
            // Position too recent, don't show yet
            return;
        }
        
        const latlng = [player.lat, player.lon];
        
        if (gameState.otherMarkers[player.playerId]) {
            // Update existing marker
            gameState.otherMarkers[player.playerId].setLatLng(latlng);
        } else {
            // Create new marker
            const icon = L.divIcon({
                className: 'player-marker',
                html: `<div class="player-marker ${player.role}" style="width: 16px; height: 16px;"></div>`,
                iconSize: [16, 16],
            });
            
            const marker = L.marker(latlng, { icon })
                .addTo(gameState.map)
                .bindPopup(`
                    ${player.playerName} (${player.role})<br>
                    <small>Position from ${Math.round(age / 1000)}s ago</small>
                `);
            
            gameState.otherMarkers[player.playerId] = marker;
        }
        
        // Check for capture (hunters only)
        if (gameState.playerRole === 'hunter' && gameState.lastPosition) {
            const distance = calculateDistance(
                gameState.lastPosition.lat,
                gameState.lastPosition.lon,
                player.lat,
                player.lon
            );
            
            if (distance <= CONFIG.CAPTURE_DISTANCE) {
                endGame('victory', `You captured ${player.playerName}!`);
            }
        }
    });
    
    // Remove markers for players who left
    Object.keys(gameState.otherMarkers).forEach(playerId => {
        if (!currentPlayerIds.has(playerId)) {
            gameState.map.removeLayer(gameState.otherMarkers[playerId]);
            delete gameState.otherMarkers[playerId];
        }
    });
    
    // Update player count
    const totalPlayers = locations.filter(p => p.gameCode === gameState.gameCode).length;
    document.getElementById('playerCount').textContent = `${totalPlayers}/4`;
}

// Game Loop
async function gameLoop() {
    // Send current position if available
    if (gameState.lastPosition) {
        await updateLocation(
            gameState.lastPosition.lat,
            gameState.lastPosition.lon,
            gameState.lastPosition.accuracy
        );
    }
    
    // Fetch all locations
    const data = await getLocations();
    
    if (data && data.locations) {
        updateOtherPlayers(data.locations);
    }
    
    // Update last update timestamp
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 
        now.getHours().toString().padStart(2, '0') + ':' + 
        now.getMinutes().toString().padStart(2, '0') + ':' + 
        now.getSeconds().toString().padStart(2, '0');
}

function updateTimer() {
    const elapsed = Date.now() - gameState.startTime;
    const remaining = CONFIG.GAME_DURATION - elapsed;
    
    if (remaining <= 0) {
        endGame('timeout', 'Time\'s up! Hunted players survived.');
        return;
    }
    
    const timerEl = document.getElementById('timer');
    timerEl.textContent = formatTime(remaining);
    
    // Change color based on time remaining
    if (remaining < 60000) { // Last minute
        timerEl.className = 'timer danger';
    } else if (remaining < 180000) { // Last 3 minutes
        timerEl.className = 'timer warning';
    } else {
        timerEl.className = 'timer';
    }
}

// Game Flow
function startGame() {
    const name = document.getElementById('playerName').value.trim();
    const code = document.getElementById('gameCode').value.trim().toUpperCase();
    const selectedRole = document.querySelector('.role-btn.selected');
    
    if (!name || !code || !selectedRole) {
        showToast('Please fill all fields', 'warning');
        return;
    }
    
    gameState.playerId = generateId();
    gameState.playerName = name;
    gameState.playerRole = selectedRole.dataset.role;
    gameState.gameCode = code;
    gameState.isActive = true;
    gameState.startTime = Date.now();
    
    // Update UI
    document.getElementById('playerNameDisplay').textContent = name;
    const roleBadge = document.getElementById('playerRole');
    roleBadge.textContent = gameState.playerRole;
    roleBadge.className = `role-badge ${gameState.playerRole}`;
    
    // Switch screens
    document.getElementById('startScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    
    // Initialize map
    initMap();
    
    // Start GPS tracking
    startGPSTracking();
    
    // Start game loop
    gameLoop(); // Initial call
    gameState.updateInterval = setInterval(gameLoop, CONFIG.UPDATE_INTERVAL);
    
    // Start timer
    updateTimer(); // Initial call
    gameState.timerInterval = setInterval(updateTimer, 1000);
    
    showToast(`Game started as ${gameState.playerRole}!`, 'success');
}

function endGame(reason, message) {
    gameState.isActive = false;
    
    // Stop intervals
    if (gameState.updateInterval) {
        clearInterval(gameState.updateInterval);
        gameState.updateInterval = null;
    }
    
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // Stop GPS
    stopGPSTracking();
    
    // Show end screen
    document.getElementById('endTitle').textContent = 
        reason === 'victory' ? '🎉 Victory!' : 
        reason === 'timeout' ? '⏰ Time\'s Up!' : 
        '👋 Game Over';
    
    document.getElementById('endMessage').textContent = message;
    
    document.getElementById('gameScreen').classList.remove('active');
    document.getElementById('endScreen').classList.add('active');
}

function leaveGame() {
    if (confirm('Are you sure you want to leave the game?')) {
        endGame('left', 'You left the game.');
    }
}

function centerMap() {
    if (gameState.map && gameState.lastPosition) {
        gameState.map.setView([
            gameState.lastPosition.lat,
            gameState.lastPosition.lon
        ], 16);
        showToast('Map centered', 'success');
    }
}

function newGame() {
    // Clean up
    if (gameState.map) {
        gameState.map.remove();
        gameState.map = null;
    }
    
    gameState.playerMarker = null;
    gameState.accuracyCircle = null;
    gameState.otherMarkers = {};
    gameState.lastPosition = null;
    
    // Reset UI
    document.getElementById('endScreen').classList.remove('active');
    document.getElementById('startScreen').classList.add('active');
    
    // Keep player info for convenience
    // document.getElementById('playerName').value = '';
    // document.getElementById('gameCode').value = '';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Role selection
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            validateStartButton();
        });
    });
    
    // Input validation
    document.getElementById('playerName').addEventListener('input', validateStartButton);
    document.getElementById('gameCode').addEventListener('input', validateStartButton);
    
    // Start button
    document.getElementById('startBtn').addEventListener('click', startGame);
    
    // Game controls
    document.getElementById('centerBtn').addEventListener('click', centerMap);
    document.getElementById('leaveBtn').addEventListener('click', leaveGame);
    
    // New game button
    document.getElementById('newGameBtn').addEventListener('click', newGame);
});

function validateStartButton() {
    const name = document.getElementById('playerName').value.trim();
    const code = document.getElementById('gameCode').value.trim();
    const role = document.querySelector('.role-btn.selected');
    
    const btn = document.getElementById('startBtn');
    btn.disabled = !(name && code && role);
}

// Handle page visibility to pause/resume when app goes to background
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState.isActive) {
        console.log('App hidden - GPS continues in background');
    } else if (!document.hidden && gameState.isActive) {
        console.log('App visible - resuming');
        gameLoop(); // Immediate update on resume
    }
});

// Warn user before leaving
window.addEventListener('beforeunload', (e) => {
    if (gameState.isActive) {
        e.preventDefault();
        e.returnValue = '';
    }
});
