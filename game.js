// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldSize = 2048; // World map is 2048x2048 pixels
        
        // WebSocket connection
        this.socket = null;
        this.connected = false;
        
        // Player data
        this.myPlayerId = null;
        this.myPlayer = null;
        this.players = {};
        this.avatars = {};
        
        // Viewport system
        this.viewportX = 0;
        this.viewportY = 0;
        
        // Movement system
        this.keysPressed = {};
        this.currentDirection = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
        this.setupKeyboardControls();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateViewport();
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.connected = true;
            this.joinGame();
        };
        
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            } catch (error) {
                console.error('Error parsing server message:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
            this.connected = false;
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Sharan'
        };
        this.socket.send(JSON.stringify(message));
    }
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.myPlayer = this.players[this.myPlayerId];
                    this.loadAvatarImages();
                    this.updateViewport();
                    this.draw();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImages();
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateViewport();
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.draw();
                break;
        }
    }
    
    loadAvatarImages() {
        // Load avatar images from base64 data
        Object.values(this.avatars).forEach(avatar => {
            if (!avatar.loadedImages) {
                avatar.loadedImages = {};
                
                Object.keys(avatar.frames).forEach(direction => {
                    avatar.loadedImages[direction] = avatar.frames[direction].map(base64Data => {
                        const img = new Image();
                        img.src = base64Data;
                        return img;
                    });
                });
            }
        });
    }
    
    updateViewport() {
        if (!this.myPlayer) return;
        
        // Center viewport on player
        this.viewportX = this.myPlayer.x - this.canvas.width / 2;
        this.viewportY = this.myPlayer.y - this.canvas.height / 2;
        
        // Clamp viewport to world boundaries
        this.viewportX = Math.max(0, Math.min(this.viewportX, this.worldSize - this.canvas.width));
        this.viewportY = Math.max(0, Math.min(this.viewportY, this.worldSize - this.canvas.height));
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,  // Source: viewport area
            0, 0, this.canvas.width, this.canvas.height  // Destination: full canvas
        );
        
        // Draw all players
        Object.values(this.players).forEach(player => {
            this.drawPlayer(player);
        });
    }
    
    drawPlayer(player) {
        const avatar = this.avatars[player.avatar];
        if (!avatar || !avatar.loadedImages) return;
        
        // Convert world coordinates to screen coordinates
        const screenX = player.x - this.viewportX;
        const screenY = player.y - this.viewportY;
        
        // Check if player is visible on screen
        if (screenX < -50 || screenX > this.canvas.width + 50 || 
            screenY < -50 || screenY > this.canvas.height + 50) {
            return;
        }
        
        // Get the appropriate avatar image
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        const avatarImages = avatar.loadedImages[direction];
        
        if (!avatarImages || !avatarImages[frameIndex]) return;
        
        const avatarImg = avatarImages[frameIndex];
        
        // Draw avatar (assuming 32x32 size, adjust as needed)
        const avatarSize = 32;
        const drawX = screenX - avatarSize / 2;
        const drawY = screenY - avatarSize;
        
        this.ctx.drawImage(avatarImg, drawX, drawY, avatarSize, avatarSize);
        
        // Draw username label
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const textX = screenX;
        const textY = drawY - 5;
        
        // Draw text outline
        this.ctx.strokeText(player.username, textX, textY);
        // Draw text fill
        this.ctx.fillText(player.username, textX, textY);
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        if (!this.connected || !this.socket) return;
        
        const key = event.key;
        let direction = null;
        
        // Map arrow keys to directions
        switch (key) {
            case 'ArrowUp':
                direction = 'up';
                break;
            case 'ArrowDown':
                direction = 'down';
                break;
            case 'ArrowLeft':
                direction = 'left';
                break;
            case 'ArrowRight':
                direction = 'right';
                break;
        }
        
        if (direction) {
            event.preventDefault(); // Prevent page scrolling
            this.keysPressed[key] = true;
            this.sendMoveCommand(direction);
        }
    }
    
    handleKeyUp(event) {
        if (!this.connected || !this.socket) return;
        
        const key = event.key;
        
        if (this.keysPressed[key]) {
            delete this.keysPressed[key];
            
            // Check if any movement keys are still pressed
            const hasMovementKeys = Object.keys(this.keysPressed).some(k => 
                ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)
            );
            
            // If no movement keys are pressed, send stop command
            if (!hasMovementKeys) {
                this.sendStopCommand();
            }
        }
    }
    
    sendMoveCommand(direction) {
        const message = {
            action: 'move',
            direction: direction
        };
        this.socket.send(JSON.stringify(message));
        this.currentDirection = direction;
    }
    
    sendStopCommand() {
        const message = {
            action: 'stop'
        };
        this.socket.send(JSON.stringify(message));
        this.currentDirection = null;
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
