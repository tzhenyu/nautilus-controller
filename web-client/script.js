// Nautilus Controller JavaScript

class NautilusController {
    constructor() {
        this.isMoving = false;
        this.currentDirection = 'stopped';
        this.updateInterval = null;
        this.map = null;
        this.robotMarker = null;
        this.currentLat = 40.7128; // Default to New York (mock location)
        this.currentLon = -74.0060;
        this.theme = localStorage.getItem('theme') || 'light';
        this.cameraController = null;
        this.depthController = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTheme();
        this.initializeMap();
        this.initializeCameraController();
        this.startStatusUpdates();
        this.updateUI();
    }

    initializeTheme() {
        // Apply saved theme
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeIcon();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateThemeIcon();
        
        // Reinitialize map with new theme if it exists
        if (this.map) {
            this.updateMapTheme();
        }
    }

    updateThemeIcon() {
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        icon.className = this.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        themeToggle.title = `Switch to ${this.theme === 'light' ? 'dark' : 'light'} mode`;
    }

    updateMapTheme() {
        if (!this.map) return;
        
        // Remove existing tile layer
        this.map.eachLayer((layer) => {
            if (layer._url) {
                this.map.removeLayer(layer);
            }
        });
        
        // Add new tile layer based on theme
        const tileUrl = this.theme === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
        L.tileLayer(tileUrl, {
            attribution: this.theme === 'dark'
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Re-add robot marker
        if (this.robotMarker) {
            this.robotMarker.addTo(this.map);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Fullscreen toggle
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

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

        // Camera toggle is now handled by CameraController        // Servo toggle
        document.getElementById('servoToggle').addEventListener('click', () => this.toggleServo());

        // Fullscreen toggle
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }    initializeMap() {
        // Initialize the Leaflet map
        this.map = L.map('map').setView([this.currentLat, this.currentLon], 18);

        // Add tile layer based on current theme
        const tileUrl = this.theme === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
        L.tileLayer(tileUrl, {
            attribution: this.theme === 'dark'
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);        // Create a custom robot icon
        const robotIcon = L.divIcon({
            className: 'robot-marker',
            html: '<div class="robot-icon"><img src="/images/nautilus2.png" alt="Nautilus" class="robot-image"><div class="robot-pulse"></div></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Add robot marker
        this.robotMarker = L.marker([this.currentLat, this.currentLon], { 
            icon: robotIcon 
        }).addTo(this.map)
            .bindPopup(`<b>Nautilus Robot</b><br>
                        Lat: ${this.currentLat.toFixed(6)}<br>
                        Lon: ${this.currentLon.toFixed(6)}<br>
                        <small>Position updates in real-time</small>`)
            .openPopup();

        console.log('Map initialized at:', this.currentLat, this.currentLon);
    }

    updateMapPosition(lat, lon) {
        if (this.map && this.robotMarker) {
            // Update marker position
            this.robotMarker.setLatLng([lat, lon]);
            
            // Update popup content
            this.robotMarker.setPopupContent(`<b>Nautilus Robot</b><br>
                                            Lat: ${lat.toFixed(6)}<br>
                                            Lon: ${lon.toFixed(6)}<br>
                                            <small>Position updates in real-time</small>`);
            
            // Center map on new position (smooth pan)
            this.map.panTo([lat, lon]);
            
            // Store current position
            this.currentLat = lat;
            this.currentLon = lon;
        }
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

    initializeCameraController() {
        // Initialize the enhanced camera controller
        this.cameraController = new CameraController();
        console.log('Camera controller initialized');
        
        // Initialize depth controller
        this.depthController = new DepthController(this.cameraController);
        console.log('Depth controller initialized');
    }    async toggleServo() {
        try {
            const response = await fetch('/api/servo/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateServoUI(data.servo_angle);
                this.updateStatusFromResponse(data);
                this.highlightElement('servoStatus');
                this.highlightElement('servoAngle');
            }
        } catch (error) {
            console.error('Error toggling servo:', error);
            this.showConnectionError();
        }
    }

    async setServoAngle(angle) {
        try {
            const response = await fetch('/api/servo/set', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ angle: angle })
            });

            if (response.ok) {
                const data = await response.json();
                this.updateServoUI(data.servo_angle);
                this.updateStatusFromResponse(data);
                this.highlightElement('servoStatus');
                this.highlightElement('servoAngle');
            }
        } catch (error) {
            console.error('Error setting servo angle:', error);
            this.showConnectionError();
        }
    }    updateServoUI(angle) {
        // Update angle display
        document.getElementById('servoAngle').textContent = `${angle}°`;
        
        // Update gauge
        this.updateServoGauge(angle);
    }

    updateServoGauge(angle) {
        const pointer = document.getElementById('servoGaugePointer');
        const fill = document.getElementById('servoGaugeFill');
        
        if (pointer && fill) {
            // Calculate rotation (0° = -90deg, 180° = 90deg)
            const rotation = (angle - 90);
            pointer.style.transform = `translate(-50%, -100%) rotate(${rotation}deg)`;
            
            // Update fill gradient
            const fillPercentage = (angle / 180) * 180; // 0 to 180 degrees
            fill.style.background = `conic-gradient(
                from -90deg,
                var(--primary-color) 0deg,
                var(--primary-color) ${fillPercentage}deg,
                transparent ${fillPercentage}deg,
                transparent 180deg
            )`;
            
            // Add update animation
            fill.classList.add('updating');
            setTimeout(() => {
                fill.classList.remove('updating');
            }, 500);
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
        // Update position - Extract coordinates
        const lat = data.state?.posY || data.posY || 0;
        const lon = data.state?.posX || data.posX || 0;
        
        document.getElementById('posX').textContent = lon.toFixed(6);
        document.getElementById('posY').textContent = lat.toFixed(6);

        document.getElementById('heading').textContent = `${Math.round(data.state?.heading || data.heading || 0)}°`;

        // Update GPS status
        const gpsStatus = data.gps_status || data.state?.gps_status || 'unknown';
        const gpsElement = document.getElementById('gpsStatus');
        if (gpsElement) {
            gpsElement.textContent = gpsStatus;
            
            // Update GPS status badge color based on status
            let badgeClass = 'bg-secondary';
            if (gpsStatus.includes('active')) badgeClass = 'bg-success';
            else if (gpsStatus.includes('connected')) badgeClass = 'bg-info';
            else if (gpsStatus.includes('error')) badgeClass = 'bg-danger';
            else if (gpsStatus.includes('initializing')) badgeClass = 'bg-warning';
            
            gpsElement.className = `badge ${badgeClass}`;
        }

        // Update map position if coordinates have changed
        if (this.map && (lat !== this.currentLat || lon !== this.currentLon)) {
            this.updateMapPosition(lat, lon);
        }

        // Update system status
        document.getElementById('currentSpeed').textContent = `${data.state?.motor_speed || data.motor_speed || 50}%`;
        document.getElementById('currentDirection').textContent = data.state?.current_direction || data.current_direction || 'stopped';
        
        // Update camera status
        const cameraEnabled = data.state?.camera_enabled || data.camera_enabled || false;
        document.getElementById('cameraStatus').textContent = cameraEnabled ? 'ON' : 'OFF';
        document.getElementById('cameraStatus').className = `badge ${cameraEnabled ? 'bg-success' : 'bg-danger'}`;        // Update servo status
        const servoAngle = data.state?.servo_angle || data.servo_angle || 0;
        document.getElementById('servoStatus').textContent = `${servoAngle}°`;
        this.updateServoUI(servoAngle);

        // Update additional info
        if (data.battery) document.getElementById('battery').textContent = `${data.battery}%`;
        if (data.temperature) document.getElementById('temperature').textContent = `${data.temperature}°C`;
        
        // Update timestamp
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
    }

    // Camera UI is now handled by CameraController

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
                if (this.cameraController) {
                    this.cameraController.toggleCamera();
                }
                break;
            case 'e':
                e.preventDefault();
                if (this.depthController) {
                    this.depthController.toggleDepth();
                }
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
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
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
    }    updateUI() {
        // Initialize UI state
        this.updateStatus();
        // Initialize servo gauge
        this.updateServoGauge(0);
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
    console.log('E: Toggle Depth');
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
