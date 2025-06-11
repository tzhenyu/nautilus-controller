/**
 * Enhanced Camera Controller with WebRTC Support
 * Handles device camera access, permissions, and advanced features
 */
class CameraController {
    constructor() {
        this.stream = null;
        this.video = null;
        this.isActive = false;
        this.isFullscreen = false;
        this.constraints = {
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                facingMode: 'user' // 'user' for front camera, 'environment' for back camera
            },
            audio: false
        };
        this.supportedConstraints = null;
        this.currentFacingMode = 'user';
        this.init();
    }

    init() {
        this.checkBrowserSupport();
        this.setupEventListeners();
        this.getSupportedConstraints();
    }

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error('WebRTC is not supported in this browser');
            this.showError('WebRTC is not supported in this browser. Please use a modern browser.');
            return false;
        }
        return true;
    }

    getSupportedConstraints() {
        if (navigator.mediaDevices.getSupportedConstraints) {
            this.supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
            console.log('Supported camera constraints:', this.supportedConstraints);
        }
    }

    setupEventListeners() {
        // Camera toggle button
        const toggleBtn = document.getElementById('cameraToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleCamera());
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreenCamera');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Retry button
        const retryBtn = document.getElementById('retryCamera');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryCamera());
        }

        // Escape key to exit fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen) {
                this.exitFullscreen();
            }
        });

        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.stream) {
                this.pauseStream();
            } else if (!document.hidden && this.stream) {
                this.resumeStream();
            }
        });
    }

    async toggleCamera() {
        if (this.isActive) {
            await this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            this.showLoading();
            this.updateToggleButton('starting', 'Starting...');

            // Request camera permissions and get stream
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            
            // Get video element
            this.video = document.getElementById('cameraVideo');
            if (!this.video) {
                throw new Error('Video element not found');
            }

            // Set up video stream
            this.video.srcObject = this.stream;
            
            // Wait for video metadata to load
            await new Promise((resolve) => {
                this.video.onloadedmetadata = resolve;
            });

            // Update UI
            this.showCameraFeed();
            this.updateResolutionInfo();
            this.updateToggleButton('active', 'Stop Camera');
            this.showFullscreenButton();
            
            this.isActive = true;
            console.log('Camera started successfully');

            // Update status
            this.updateCameraStatus(true);

        } catch (error) {
            console.error('Error starting camera:', error);
            this.handleCameraError(error);
        }
    }

    async stopCamera() {
        try {
            this.updateToggleButton('stopping', 'Stopping...');

            // Stop depth estimation if it's active (depth depends on camera)
            if (window.controller && window.controller.depthController && window.controller.depthController.isDepthEnabled) {
                await window.controller.depthController.autoStopDepth();
            }

            if (this.stream) {
                // Stop all tracks
                this.stream.getTracks().forEach(track => {
                    track.stop();
                });
                
                // Clear video source
                if (this.video) {
                    this.video.srcObject = null;
                }
                
                this.stream = null;
            }

            // Exit fullscreen if active
            if (this.isFullscreen) {
                this.exitFullscreen();
            }

            // Update UI
            this.showPlaceholder();
            this.updateToggleButton('inactive', 'Start Camera');
            this.hideFullscreenButton();
            
            this.isActive = false;
            console.log('Camera stopped successfully');

            // Update status
            this.updateCameraStatus(false);

        } catch (error) {
            console.error('Error stopping camera:', error);
        }
    }

    retryCamera() {
        this.hideError();
        this.startCamera();
    }

    pauseStream() {
        if (this.stream) {
            this.stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }

    resumeStream() {
        if (this.stream) {
            this.stream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
        }
    }

    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        const cameraFeed = document.getElementById('cameraFeed');
        if (!cameraFeed || !this.isActive) return;

        cameraFeed.classList.add('camera-fullscreen');
        
        // Add circular close/zoom out button
        const exitBtn = document.createElement('button');
        exitBtn.className = 'exit-fullscreen';
        exitBtn.innerHTML = '<i class="fas fa-times"></i>';
        exitBtn.title = 'Zoom Out (Esc)';
        exitBtn.setAttribute('aria-label', 'Exit fullscreen and zoom out');
        exitBtn.onclick = () => this.exitFullscreen();
        
        // Add hover effects and click animation
        exitBtn.addEventListener('mouseenter', () => {
            exitBtn.style.transform = 'scale(1.1)';
        });
        
        exitBtn.addEventListener('mouseleave', () => {
            exitBtn.style.transform = 'scale(1)';
        });
        
        const controls = document.createElement('div');
        controls.className = 'fullscreen-controls';
        controls.appendChild(exitBtn);
        
        cameraFeed.appendChild(controls);
        
        this.isFullscreen = true;
        
        // Try to enter browser fullscreen
        if (cameraFeed.requestFullscreen) {
            cameraFeed.requestFullscreen().catch(console.log);
        }
        
        // Update zoom button text
        const fullscreenBtn = document.getElementById('fullscreenCamera');
        if (fullscreenBtn) {
            fullscreenBtn.title = 'Zoom Out Camera';
            fullscreenBtn.innerHTML = '<i class="fas fa-search-minus me-1"></i><span>Zoom</span>';
        }
        
        // Log for user feedback
        console.log('Camera zoomed in (fullscreen mode). Press Esc or click the × button to zoom out.');
    }

    exitFullscreen() {
        const cameraFeed = document.getElementById('cameraFeed');
        if (!cameraFeed) return;

        cameraFeed.classList.remove('camera-fullscreen');
        
        // Remove fullscreen controls
        const controls = cameraFeed.querySelector('.fullscreen-controls');
        if (controls) {
            controls.remove();
        }
        
        this.isFullscreen = false;
        
        // Update zoom button back to zoom in
        const fullscreenBtn = document.getElementById('fullscreenCamera');
        if (fullscreenBtn) {
            fullscreenBtn.title = 'Zoom In Camera';
            fullscreenBtn.innerHTML = '<i class="fas fa-search-plus me-1"></i><span>Zoom</span>';
        }
        
        // Exit browser fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.log);
        }
        
        // Log for user feedback
        console.log('Camera zoomed out (normal view).');
    }

    async switchCamera() {
        if (!this.isActive) return;

        try {
            this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
            this.constraints.video.facingMode = this.currentFacingMode;
            
            // Stop current stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            // Start with new constraints
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            this.video.srcObject = this.stream;
            
            this.updateResolutionInfo();
            
        } catch (error) {
            console.error('Error switching camera:', error);
            // Fallback to previous facing mode
            this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
            this.constraints.video.facingMode = this.currentFacingMode;
        }
    }

    updateResolutionInfo() {
        if (!this.video) return;

        const resolutionElement = document.getElementById('cameraResolution');
        if (resolutionElement && this.video.videoWidth && this.video.videoHeight) {
            resolutionElement.textContent = `${this.video.videoWidth} × ${this.video.videoHeight}`;
        }
    }

    updateToggleButton(state, text) {
        const toggleBtn = document.getElementById('cameraToggle');
        const toggleText = document.getElementById('cameraToggleText');
        
        if (!toggleBtn || !toggleText) return;

        toggleBtn.disabled = state === 'stopping' || state === 'starting';
        toggleText.textContent = text;
        
        // Update button style based on state
        toggleBtn.className = 'btn btn-sm rounded-pill camera-btn ';
        switch (state) {
            case 'active':
                toggleBtn.className += 'btn-danger';
                break;
            case 'inactive':
                toggleBtn.className += 'btn-success';
                break;
            case 'starting':
                toggleBtn.className += 'btn-warning';
                break;
            case 'stopping':
                toggleBtn.className += 'btn-secondary';
                break;
        }
    }

    showPlaceholder() {
        document.getElementById('cameraPlaceholder').style.display = 'flex';
        document.getElementById('cameraFeed').style.display = 'none';
        document.getElementById('cameraError').style.display = 'none';
        document.getElementById('cameraLoading').style.display = 'none';
    }

    showCameraFeed() {
        document.getElementById('cameraPlaceholder').style.display = 'none';
        document.getElementById('cameraFeed').style.display = 'flex';
        document.getElementById('cameraError').style.display = 'none';
        document.getElementById('cameraLoading').style.display = 'none';
    }

    showError(message) {
        document.getElementById('cameraPlaceholder').style.display = 'none';
        document.getElementById('cameraFeed').style.display = 'none';
        document.getElementById('cameraError').style.display = 'flex';
        document.getElementById('cameraLoading').style.display = 'none';
        
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }

    hideError() {
        document.getElementById('cameraError').style.display = 'none';
    }

    showLoading() {
        document.getElementById('cameraPlaceholder').style.display = 'none';
        document.getElementById('cameraFeed').style.display = 'none';
        document.getElementById('cameraError').style.display = 'none';
        document.getElementById('cameraLoading').style.display = 'flex';
    }

    showFullscreenButton() {
        const fullscreenBtn = document.getElementById('fullscreenCamera');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'inline-block';
        }
        
        // Also show depth button when camera is active
        this.showDepthButton();
    }

    showDepthButton() {
        const depthBtn = document.getElementById('depthToggle');
        if (depthBtn) {
            depthBtn.style.display = 'inline-block';
        }
    }

    hideFullscreenButton() {
        const fullscreenBtn = document.getElementById('fullscreenCamera');
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'none';
        }
        
        // Also hide depth button when camera is inactive
        this.hideDepthButton();
    }

    hideDepthButton() {
        const depthBtn = document.getElementById('depthToggle');
        if (depthBtn) {
            depthBtn.style.display = 'none';
        }
    }

    handleCameraError(error) {
        // Stop depth estimation if it was active (camera dependency)
        if (window.controller && window.controller.depthController && window.controller.depthController.isDepthEnabled) {
            window.controller.depthController.autoStopDepth();
        }

        let errorMessage = 'Unable to access camera';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera device found. Please connect a camera and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera is already in use by another application.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            errorMessage = 'Camera does not support the requested settings.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Camera is not supported in this browser.';
        } else if (error.name === 'TypeError') {
            errorMessage = 'Invalid camera configuration.';
        }

        this.showError(errorMessage);
        this.updateToggleButton('inactive', 'Start Camera');
        this.updateCameraStatus(false);
        this.isActive = false;
    }

    updateCameraStatus(enabled) {
        // Update the status indicator in the UI
        const statusElement = document.getElementById('cameraStatus');
        if (statusElement) {
            statusElement.textContent = enabled ? 'ON' : 'OFF';
            statusElement.className = `badge ${enabled ? 'bg-success' : 'bg-danger'} rounded-pill`;
        }
    }

    async getAvailableDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('Available video devices:', videoDevices);
            return videoDevices;
        } catch (error) {
            console.error('Error getting devices:', error);
            return [];
        }
    }

    destroy() {
        // Clean up resources
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
        
        this.stream = null;
        this.video = null;
        this.isActive = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraController;
} 