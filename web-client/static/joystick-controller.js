/**
 * Enhanced Joystick Controller for Nautilus Robot
 * Supports diagonal movement, touch/mouse controls, and smooth operation
 */

class JoystickController {
    constructor(nautilusController) {
        this.nautilusController = nautilusController;
        this.joystickBase = null;
        this.joystickKnob = null;
        this.isJoystickMode = true;
        this.isDragging = false;
        this.currentDirection = null;
        this.currentIntensity = 0;
        this.baseRadius = 100; // Base circle radius
        this.knobRadius = 40;  // Knob radius
        this.centerX = 0;
        this.centerY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.deadZone = 0.1; // 10% dead zone for more responsive controls
        this.maxDistance = this.baseRadius - this.knobRadius;
        
        // Movement intervals
        this.movementInterval = null;
        this.movementDelay = 30; // ms between movement commands (very smooth)
        this.smoothingFactor = 0.15; // For smooth position interpolation
        
        // Debounce parameters for smooth controls
        this.lastUpdateTime = 0;
        this.updateThrottle = 16; // ~60fps updates
        
        this.init();
    }

    init() {
        this.joystickBase = document.getElementById('joystickBase');
        this.joystickKnob = document.getElementById('joystickKnob');
        
        if (!this.joystickBase || !this.joystickKnob) {
            console.error('Joystick elements not found');
            return;
        }

        this.setupEventListeners();
        this.updateBaseMetrics();
    }

    setupEventListeners() {
        // Control mode toggle
        const controlModeToggle = document.getElementById('controlModeToggle');
        if (controlModeToggle) {
            controlModeToggle.addEventListener('click', () => this.toggleControlMode());
        }

        // Joystick events
        this.setupJoystickEvents();

        // Center emergency stop
        this.setupCenterEmergencyStop();

        // Window resize handler
        window.addEventListener('resize', () => this.updateBaseMetrics());
    }

    setupJoystickEvents() {
        // Mouse events
        this.joystickKnob.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.stopDrag());

        // Touch events
        this.joystickKnob.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrag(e.touches[0]);
        });
        
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isDragging) {
                this.drag(e.touches[0]);
            }
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrag();
        });

        // Base click/touch to move knob
        this.joystickBase.addEventListener('click', (e) => this.moveKnobToPosition(e));
        this.joystickBase.addEventListener('touchstart', (e) => {
            if (e.target === this.joystickBase) {
                e.preventDefault();
                this.moveKnobToPosition(e.touches[0]);
            }
        });
    }

    setupCenterEmergencyStop() {
        const centerDot = document.querySelector('.joystick-center-dot');
        if (centerDot) {
            centerDot.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent joystick movement
                this.emergencyStop();
            });

            centerDot.addEventListener('touchstart', (e) => {
                e.stopPropagation(); // Prevent joystick movement
                e.preventDefault();
            });

            centerDot.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.emergencyStop();
            });
        }
    }

    updateBaseMetrics() {
        if (!this.joystickBase) return;
        
        const rect = this.joystickBase.getBoundingClientRect();
        this.centerX = rect.left + rect.width / 2;
        this.centerY = rect.top + rect.height / 2;
        this.baseRadius = rect.width / 2;
        this.maxDistance = this.baseRadius - this.knobRadius;
    }

    startDrag(event) {
        this.isDragging = true;
        this.joystickKnob.style.cursor = 'grabbing';
        this.updateBaseMetrics();
        this.drag(event);
    }

    drag(event) {
        if (!this.isDragging) return;

        const clientX = event.clientX || event.pageX;
        const clientY = event.clientY || event.pageY;

        // Calculate relative position from center
        let deltaX = clientX - this.centerX;
        let deltaY = clientY - this.centerY;

        // Calculate distance from center
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Constrain to base circle
        if (distance > this.maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            deltaX = Math.cos(angle) * this.maxDistance;
            deltaY = Math.sin(angle) * this.maxDistance;
        }

        // Update knob position
        this.currentX = deltaX;
        this.currentY = deltaY;
        this.updateKnobPosition();

        // Calculate direction and intensity
        this.updateMovementData();
    }

    stopDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.joystickKnob.style.cursor = 'grab';
        
        // Return knob to center with animation
        this.returnToCenter();
    }

    moveKnobToPosition(event) {
        if (this.isDragging) return;

        const clientX = event.clientX || event.pageX;
        const clientY = event.clientY || event.pageY;

        // Calculate relative position from center
        let deltaX = clientX - this.centerX;
        let deltaY = clientY - this.centerY;

        // Calculate distance from center
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Constrain to base circle
        if (distance > this.maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            deltaX = Math.cos(angle) * this.maxDistance;
            deltaY = Math.sin(angle) * this.maxDistance;
        }

        // Update knob position
        this.currentX = deltaX;
        this.currentY = deltaY;
        this.updateKnobPosition();
        this.updateMovementData();

        // Auto return to center after a short delay
        setTimeout(() => {
            if (!this.isDragging) {
                this.returnToCenter();
            }
        }, 2000);
    }

    updateKnobPosition() {
        // Smooth position interpolation for fluid movement
        this.joystickKnob.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;
        this.joystickKnob.style.transition = this.isDragging ? 'none' : 'transform 0.1s ease-out';
    }

    returnToCenter() {
        this.currentX = 0;
        this.currentY = 0;
        this.joystickKnob.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0.38, 0.9)';
        this.updateKnobPosition();
        
        // Remove transition after animation
        setTimeout(() => {
            this.joystickKnob.style.transition = '';
        }, 250);

        // Stop movement
        this.stopMovement();
    }

    updateMovementData() {
        // Throttle updates for smoother performance
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateThrottle) {
            return;
        }
        this.lastUpdateTime = now;
        
        const distance = Math.sqrt(this.currentX * this.currentX + this.currentY * this.currentY);
        const normalizedDistance = distance / this.maxDistance;

        // Apply dead zone
        if (normalizedDistance < this.deadZone) {
            this.currentIntensity = 0;
            this.currentDirection = null;
            this.stopMovement();
            this.updateUI();
            return;
        }

        // Calculate intensity (0-100%) with smoother scaling
        const intensityScale = (normalizedDistance - this.deadZone) / (1 - this.deadZone);
        this.currentIntensity = Math.min(Math.round(intensityScale * 100), 100);

        // Calculate direction
        this.currentDirection = this.calculateDirection(this.currentX, this.currentY);

        // Update UI
        this.updateUI();

        // Start movement
        this.startMovement();
    }

    calculateDirection(x, y) {
        const angle = Math.atan2(-y, x) * 180 / Math.PI; // Negative y for screen coordinates
        const normalizedAngle = (angle + 360) % 360;

        // Define direction ranges (4 directions only - 90° sectors for better accuracy)
        const directions = [
            { name: 'right', min: 315, max: 360, code: 'right' },
            { name: 'right', min: 0, max: 45, code: 'right' },
            { name: 'forward', min: 45, max: 135, code: 'forward' },
            { name: 'left', min: 135, max: 225, code: 'left' },
            { name: 'backward', min: 225, max: 315, code: 'backward' }
        ];

        for (const dir of directions) {
            if (normalizedAngle >= dir.min && normalizedAngle < dir.max) {
                return {
                    name: dir.name,
                    code: dir.code,
                    angle: normalizedAngle
                };
            }
        }

        return { name: 'center', code: 'stop', angle: 0 };
    }

    updateUI() {
        // Update direction display
        const directionDisplay = document.getElementById('currentJoystickDirection');
        if (directionDisplay) {
            const directionText = this.currentDirection ? 
                this.currentDirection.name.toUpperCase() : 'CENTER';
            directionDisplay.textContent = directionText;
            
            // Update badge color based on movement
            directionDisplay.className = this.currentIntensity > 0 ? 
                'badge bg-success rounded-pill' : 'badge bg-secondary rounded-pill';
        }

        // Update intensity display
        const intensityDisplay = document.getElementById('currentJoystickIntensity');
        if (intensityDisplay) {
            intensityDisplay.textContent = `${this.currentIntensity}%`;
            
            // Update badge color based on intensity
            if (this.currentIntensity === 0) {
                intensityDisplay.className = 'badge bg-secondary rounded-pill';
            } else if (this.currentIntensity < 50) {
                intensityDisplay.className = 'badge bg-info rounded-pill';
            } else if (this.currentIntensity < 80) {
                intensityDisplay.className = 'badge bg-warning rounded-pill';
            } else {
                intensityDisplay.className = 'badge bg-danger rounded-pill';
            }
        }

        // Update direction indicators
        this.updateDirectionIndicators();
    }

    updateDirectionIndicators() {
        const indicators = document.querySelectorAll('.direction-indicator');
        indicators.forEach(indicator => {
            indicator.classList.remove('active');
        });

        if (this.currentDirection && this.currentIntensity > 0) {
            const directionClass = this.getDirectionClass(this.currentDirection.name);
            const activeIndicator = document.querySelector(`.direction-${directionClass}`);
            if (activeIndicator) {
                activeIndicator.classList.add('active');
            }
        }
    }

    getDirectionClass(directionName) {
        const mapping = {
            'forward': 'n',
            'right': 'e',
            'backward': 's',
            'left': 'w'
        };
        return mapping[directionName] || 'n';
    }

    startMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
        }

        if (!this.currentDirection || this.currentIntensity === 0) return;

        // Send initial movement command
        this.sendMovementCommand();

        // Set up interval for continuous movement
        this.movementInterval = setInterval(() => {
            if (this.currentDirection && this.currentIntensity > 0) {
                this.sendMovementCommand();
            } else {
                this.stopMovement();
            }
        }, this.movementDelay);
    }

    stopMovement() {
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }

        // Send stop command
        this.nautilusController.stopMovement();
        
        // Update UI
        this.currentDirection = null;
        this.currentIntensity = 0;
        this.updateUI();
    }

    async sendMovementCommand() {
        if (!this.currentDirection) return;

        try {
            // Prepare movement data
            const movementData = {
                direction: this.currentDirection.code,
                intensity: this.currentIntensity,
                angle: this.currentDirection.angle
            };

            // Send to backend via nautilus controller
            const response = await fetch('/api/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(movementData)
            });

            if (response.ok) {
                const data = await response.json();
                // Update nautilus controller state
                this.nautilusController.isMoving = true;
                this.nautilusController.currentDirection = this.currentDirection.name;
                this.nautilusController.updateStatusFromResponse(data);
            }
        } catch (error) {
            console.error('Movement command error:', error);
            this.nautilusController.showConnectionError();
        }
    }

    toggleControlMode() {
        this.isJoystickMode = !this.isJoystickMode;
        
        const joystickControls = document.getElementById('joystickControls');
        const buttonControls = document.getElementById('buttonControls');
        const controlModeText = document.getElementById('controlModeText');
        const controlModeToggle = document.getElementById('controlModeToggle');

        if (this.isJoystickMode) {
            // Switch to joystick mode
            joystickControls.style.display = 'block';
            buttonControls.style.display = 'none';
            controlModeText.textContent = 'Buttons';
            controlModeToggle.innerHTML = '<i class="fas fa-hand-pointer me-1"></i><span id="controlModeText">Buttons</span>';
            controlModeToggle.title = 'Switch to Button Controls';
        } else {
            // Switch to button mode
            joystickControls.style.display = 'none';
            buttonControls.style.display = 'block';
            controlModeText.textContent = 'Joystick';
            controlModeToggle.innerHTML = '<i class="fas fa-gamepad me-1"></i><span id="controlModeText">Joystick</span>';
            controlModeToggle.title = 'Switch to Joystick Controls';
        }

        // Stop any current movement
        this.stopMovement();
        this.returnToCenter();
    }

    emergencyStop() {
        // Immediate stop
        this.stopMovement();
        this.returnToCenter();
        
        // Send emergency stop to backend
        this.nautilusController.stopMovement();
        
        // Haptic feedback for mobile devices
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]); // Short vibration pattern
        }
        
        // Visual feedback on joystick knob
        this.joystickKnob.classList.add('emergency-mode');
        setTimeout(() => {
            this.joystickKnob.classList.remove('emergency-mode');
        }, 600);

        // Update UI to show emergency stop
        const directionDisplay = document.getElementById('currentJoystickDirection');
        const intensityDisplay = document.getElementById('currentJoystickIntensity');
        
        if (directionDisplay) {
            directionDisplay.textContent = 'EMERGENCY STOP';
            directionDisplay.className = 'badge bg-danger rounded-pill';
            setTimeout(() => {
                directionDisplay.textContent = 'CENTER';
                directionDisplay.className = 'badge bg-secondary rounded-pill';
            }, 2000);
        }
        
        if (intensityDisplay) {
            intensityDisplay.textContent = 'STOPPED';
            intensityDisplay.className = 'badge bg-danger rounded-pill';
            setTimeout(() => {
                intensityDisplay.textContent = '0%';
                intensityDisplay.className = 'badge bg-secondary rounded-pill';
            }, 2000);
        }

        console.log('🛑 Emergency stop activated via joystick center');
    }

    // Public methods for integration
    isInJoystickMode() {
        return this.isJoystickMode;
    }

    getCurrentDirection() {
        return this.currentDirection;
    }

    getCurrentIntensity() {
        return this.currentIntensity;
    }

    forceStop() {
        this.emergencyStop();
    }
} 