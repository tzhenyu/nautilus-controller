// Nautilus Controller JavaScript

class NautilusController {
    constructor() {
        this.isMoving = false;
        this.currentDirection = 'stopped';
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startStatusUpdates();
        this.updateUI();
    }

    setupEventListeners() {
        // Movement controls
        document.querySelectorAll('.control-btn[data-direction]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => this.startMovement(e.target.dataset.direction));
            btn.addEventListener('mouseup', () => this.stopMovement());
            btn.addEventListener('mouseleave', () => this.stopMovement());
            
            // Touch events for mobile
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startMovement(e.target.dataset.direction);
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopMovement();
            });
        });

        // Stop button
        document.getElementById('stopBtn').addEventListener('click', () => this.stopMovement());

        // Speed control
        const speedSlider = document.getElementById('speedSlider');
        speedSlider.addEventListener('input', (e) => {
            document.getElementById('speedValue').textContent = e.target.value;
            this.setSpeed(e.target.value);
        });

        // Camera toggle
        document.getElementById('cameraToggle').addEventListener('click', () => this.toggleCamera());

        // Servo toggle
        document.getElementById('servoToggle').addEventListener('click', () => this.toggleServo());

        // Fullscreen toggle
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    async startMovement(direction) {
        if (this.isMoving && this.currentDirection === direction) return;

        try {
            const response = await fetch('/api/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ direction: direction })
            });

            if (response.ok) {
                const data = await response.json();
                this.isMoving = true;
                this.currentDirection = direction;
                this.updateButtonStates();
                this.updateStatusFromResponse(data);
            }
        } catch (error) {
            console.error('Error starting movement:', error);
            this.showConnectionError();
        }
    }

    async stopMovement() {
        if (!this.isMoving) return;

        try {
            const response = await fetch('/api/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.isMoving = false;
                this.currentDirection = 'stopped';
                this.updateButtonStates();
                this.updateStatusFromResponse(data);
            }
        } catch (error) {
            console.error('Error stopping movement:', error);
            this.showConnectionError();
        }
    }

    async setSpeed(speed) {
        try {
            const response = await fetch('/api/speed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ speed: parseInt(speed) })
            });

            if (response.ok) {
                const data = await response.json();
                this.updateStatusFromResponse(data);
                this.highlightElement('currentSpeed');
            }
        } catch (error) {
            console.error('Error setting speed:', error);
            this.showConnectionError();
        }
    }

    async toggleCamera() {
        try {
            const response = await fetch('/api/camera/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateCameraUI(data.camera_enabled);
                this.updateStatusFromResponse(data);
                this.highlightElement('cameraStatus');
            }
        } catch (error) {
            console.error('Error toggling camera:', error);
            this.showConnectionError();
        }
    }

    async toggleServo() {
        try {
            const response = await fetch('/api/servo/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('servoAngle').textContent = `${data.servo_angle}°`;
                this.updateStatusFromResponse(data);
                this.highlightElement('servoStatus');
                this.highlightElement('servoAngle');
            }
        } catch (error) {
            console.error('Error toggling servo:', error);
            this.showConnectionError();
        }
    }

    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const data = await response.json();
                this.updateStatusFromResponse(data);
                this.showConnectionStatus(true);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            this.showConnectionError();
        }
    }

    updateStatusFromResponse(data) {
        // Update position
        document.getElementById('posX').textContent = data.state?.x?.toFixed(2) || data.x?.toFixed(2) || '0.0';
        document.getElementById('posY').textContent = data.state?.y?.toFixed(2) || data.y?.toFixed(2) || '0.0';
        document.getElementById('heading').textContent = `${Math.round(data.state?.heading || data.heading || 0)}°`;

        // Update system status
        document.getElementById('currentSpeed').textContent = `${data.state?.motor_speed || data.motor_speed || 50}%`;
        document.getElementById('currentDirection').textContent = data.state?.current_direction || data.current_direction || 'stopped';
        
        // Update camera status
        const cameraEnabled = data.state?.camera_enabled || data.camera_enabled || false;
        document.getElementById('cameraStatus').textContent = cameraEnabled ? 'ON' : 'OFF';
        document.getElementById('cameraStatus').className = `badge ${cameraEnabled ? 'bg-success' : 'bg-danger'}`;

        // Update servo status
        const servoAngle = data.state?.servo_angle || data.servo_angle || 0;
        document.getElementById('servoStatus').textContent = `${servoAngle}°`;

        // Update additional info
        if (data.battery) document.getElementById('battery').textContent = `${data.battery}%`;
        if (data.temperature) document.getElementById('temperature').textContent = `${data.temperature}°C`;
        
        // Update timestamp
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
    }

    updateCameraUI(enabled) {
        const placeholder = document.getElementById('cameraPlaceholder');
        const feed = document.getElementById('cameraFeed');
        
        if (enabled) {
            placeholder.style.display = 'none';
            feed.style.display = 'block';
        } else {
            placeholder.style.display = 'block';
            feed.style.display = 'none';
        }
    }

    updateButtonStates() {
        // Remove active class from all movement buttons
        document.querySelectorAll('.control-btn[data-direction]').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to current direction button
        if (this.isMoving && this.currentDirection !== 'stopped') {
            const activeBtn = document.querySelector(`[data-direction="${this.currentDirection}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }

    handleKeyDown(e) {
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                e.preventDefault();
                this.startMovement('forward');
                break;
            case 's':
            case 'arrowdown':
                e.preventDefault();
                this.startMovement('backward');
                break;
            case 'a':
            case 'arrowleft':
                e.preventDefault();
                this.startMovement('left');
                break;
            case 'd':
            case 'arrowright':
                e.preventDefault();
                this.startMovement('right');
                break;
            case ' ':
                e.preventDefault();
                this.stopMovement();
                break;
            case 'c':
                e.preventDefault();
                this.toggleCamera();
                break;
            case 'v':
                e.preventDefault();
                this.toggleServo();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'w':
            case 's':
            case 'a':
            case 'd':
            case 'arrowup':
            case 'arrowdown':
            case 'arrowleft':
            case 'arrowright':
                e.preventDefault();
                this.stopMovement();
                break;
        }
    }

    toggleFullscreen() {
        const container = document.querySelector('.container-fluid');
        const btn = document.getElementById('fullscreenBtn');
        const icon = btn.querySelector('i');
        
        if (container.classList.contains('fullscreen')) {
            container.classList.remove('fullscreen');
            icon.className = 'fas fa-expand';
            btn.title = 'Enter Fullscreen';
        } else {
            container.classList.add('fullscreen');
            icon.className = 'fas fa-compress';
            btn.title = 'Exit Fullscreen';
        }
    }

    startStatusUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateStatus();
        }, 1000); // Update every second
    }

    showConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (connected) {
            statusElement.className = 'connection-status connected';
            statusElement.innerHTML = '<i class="fas fa-wifi"></i> Connected';
        } else {
            statusElement.className = 'connection-status disconnected';
            statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Disconnected';
        }
    }

    showConnectionError() {
        this.showConnectionStatus(false);
        // Optional: Show toast notification
        console.error('Connection error - check server status');
    }

    highlightElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('updated');
            setTimeout(() => {
                element.classList.remove('updated');
            }, 500);
        }
    }

    updateUI() {
        // Initialize UI state
        this.updateStatus();
    }
}

// Utility functions for quick speed setting
function setSpeed(speed) {
    const slider = document.getElementById('speedSlider');
    const display = document.getElementById('speedValue');
    
    slider.value = speed;
    display.textContent = speed;
    
    if (window.controller) {
        window.controller.setSpeed(speed);
    }
}

// Initialize controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.controller = new NautilusController();
    
    // Add some helpful keyboard shortcuts info
    console.log('Keyboard shortcuts:');
    console.log('WASD or Arrow Keys: Move');
    console.log('Space: Stop');
    console.log('C: Toggle Camera');
    console.log('V: Toggle Servo');
    console.log('F: Toggle Fullscreen');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, stop movement for safety
        if (window.controller && window.controller.isMoving) {
            window.controller.stopMovement();
        }
    }
});
