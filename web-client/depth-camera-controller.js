/**
 * Depth Camera Controller for Nautilus Controller
 * Handles depth camera integration with side-by-side display
 */
class DepthCameraController {
    constructor() {
        this.isEnabled = false;
        this.isProcessing = false;
        this.processingInterval = null;
        this.depthCanvas = null;
        this.depthContext = null;
        this.currentColormap = 'Plasma';
        this.lastDepthFrame = null;
        this.frameProcessRate = 3; // Process every 3 frames for performance
        this.frameCounter = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkServiceAvailability();
    }

    setupEventListeners() {
        // Depth camera toggle button
        const toggleBtn = document.getElementById('depthCameraToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleDepthCamera());
        }

        // Colormap change button
        const colormapBtn = document.getElementById('changeColormap');
        if (colormapBtn) {
            colormapBtn.addEventListener('click', () => this.changeColormap());
        }
    }

    async checkServiceAvailability() {
        try {
            const response = await fetch('/api/depth-camera/status');
            const data = await response.json();
            
            if (response.ok && data.depth_status && data.depth_status.available) {
                this.updateAvailabilityUI(true);
                this.currentColormap = data.depth_status.colormap || 'Plasma';
                console.log('Depth Camera service is available');
            } else {
                this.updateAvailabilityUI(false);
                console.warn('Depth Camera service is not available');
            }
        } catch (error) {
            console.error('Error checking depth camera service:', error);
            this.updateAvailabilityUI(false);
        }
    }

    updateAvailabilityUI(available) {
        const toggleBtn = document.getElementById('depthCameraToggle');
        const statusIndicator = document.getElementById('depthCameraStatus');
        
        if (toggleBtn) {
            toggleBtn.disabled = !available;
            if (available) {
                // Service is available - set to normal state
                toggleBtn.innerHTML = '<i class="fas fa-cube me-1"></i>Start Depth Camera';
                toggleBtn.className = 'btn btn-primary btn-sm rounded-pill';
            } else {
                // Service is not available
                toggleBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Unavailable';
                toggleBtn.className = 'btn btn-secondary btn-sm rounded-pill';
            }
            // Don't change visibility here - let camera controller handle it
            // The button should remain hidden until camera is active
        }

        if (statusIndicator) {
            statusIndicator.textContent = available ? 'Available' : 'Unavailable';
            statusIndicator.className = available ? 'badge bg-success rounded-pill' : 'badge bg-danger rounded-pill';
        }
    }

    async toggleDepthCamera() {
        if (this.isEnabled) {
            await this.stopDepthCamera();
        } else {
            await this.startDepthCamera();
        }
    }

    async startDepthCamera() {
        try {
            this.updateToggleButton('starting', 'Starting...');

            // Check if camera is active
            if (!window.controller || !window.controller.cameraController || !window.controller.cameraController.isActive) {
                this.showError('Camera must be active to start depth detection');
                this.updateToggleButton('inactive', 'Start Depth Camera');
                return;
            }

            // Enable depth camera on server
            const response = await fetch('/api/depth-camera/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                this.isEnabled = true;
                this.enableSideBySideView();
                this.startFrameProcessing();
                this.updateToggleButton('active', 'Stop Depth Camera');
                this.updateDepthCameraStatus(true);
                this.showColormapButton();
                console.log('Depth camera started successfully');
            } else {
                throw new Error(data.message || 'Failed to start depth camera');
            }

        } catch (error) {
            console.error('Error starting depth camera:', error);
            this.handleDepthCameraError(error);
        }
    }

    async stopDepthCamera() {
        try {
            this.updateToggleButton('stopping', 'Stopping...');

            // Disable depth camera on server
            const response = await fetch('/api/depth-camera/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                this.isEnabled = false;
                this.stopFrameProcessing();
                this.disableSideBySideView();
                this.updateToggleButton('inactive', 'Start Depth Camera');
                this.updateDepthCameraStatus(false);
                this.hideColormapButton();
                console.log('Depth camera stopped successfully');
            } else {
                throw new Error(data.message || 'Failed to stop depth camera');
            }

        } catch (error) {
            console.error('Error stopping depth camera:', error);
            this.updateToggleButton('inactive', 'Start Depth Camera');
        }
    }

    enableSideBySideView() {
        const cameraContainer = document.getElementById('cameraContainer');
        const cameraVideo = document.getElementById('cameraVideo');
        
        if (!cameraContainer || !cameraVideo) return;

        // Add depth camera class to container
        cameraContainer.classList.add('depth-camera-active');
        
        // Create depth canvas if it doesn't exist
        if (!this.depthCanvas) {
            this.depthCanvas = document.createElement('canvas');
            this.depthCanvas.id = 'depthCanvas';
            this.depthCanvas.className = 'depth-camera-canvas';
            this.depthContext = this.depthCanvas.getContext('2d');
            
            // Set canvas size to match video
            this.depthCanvas.width = cameraVideo.videoWidth || 640;
            this.depthCanvas.height = cameraVideo.videoHeight || 480;
            
            cameraContainer.appendChild(this.depthCanvas);
        }

        // Show depth canvas as flex item and ensure it matches video height
        this.depthCanvas.style.display = 'block';
        this.depthCanvas.style.height = '450px';
        this.depthCanvas.style.width = '50%';
        this.depthCanvas.style.objectFit = 'cover';
        
        // Add depth info overlay
        this.createDepthInfoOverlay();
        
        // Update header text
        const headerText = document.querySelector('.camera-header-text');
        if (headerText) {
            headerText.innerHTML = '<i class="fas fa-video-camera me-2"></i>Camera & Depth Detection';
        }
    }

    disableSideBySideView() {
        const cameraContainer = document.getElementById('cameraContainer');
        
        if (!cameraContainer) return;

        // Remove depth camera class
        cameraContainer.classList.remove('depth-camera-active');
        
        // Hide depth canvas
        if (this.depthCanvas) {
            this.depthCanvas.style.display = 'none';
        }
        
        // Remove depth info overlay
        this.removeDepthInfoOverlay();
        
        // Update header text
        const headerText = document.querySelector('.camera-header-text');
        if (headerText) {
            headerText.innerHTML = '<i class="fas fa-video-camera me-2"></i>Live Camera Feed';
        }
    }

    createDepthInfoOverlay() {
        // Remove existing overlay
        this.removeDepthInfoOverlay();
        
        const cameraContainer = document.getElementById('cameraContainer');
        if (!cameraContainer) return;

        const infoOverlay = document.createElement('div');
        infoOverlay.id = 'depthInfoOverlay';
        infoOverlay.className = 'depth-info-overlay';
        infoOverlay.innerHTML = `
            <div class="depth-info-panel">
                <div class="depth-stats">
                    <span class="depth-colormap">Colormap: <span id="currentColormap">${this.currentColormap}</span></span>
                    <span class="depth-status">Status: <span id="depthProcessingStatus">Processing...</span></span>
                </div>
            </div>
        `;
        
        cameraContainer.appendChild(infoOverlay);
    }

    removeDepthInfoOverlay() {
        const overlay = document.getElementById('depthInfoOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    startFrameProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }

        this.processingInterval = setInterval(() => {
            if (this.isEnabled && !this.isProcessing) {
                this.frameCounter++;
                if (this.frameCounter % this.frameProcessRate === 0) {
                    this.processCurrentFrame();
                }
            }
        }, 100); // Check every 100ms
    }

    stopFrameProcessing() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    async processCurrentFrame() {
        if (!this.isEnabled || this.isProcessing) return;

        const video = document.getElementById('cameraVideo');
        if (!video || video.videoWidth === 0) return;

        try {
            this.isProcessing = true;

            // Capture frame from video
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            
            // Convert to base64
            const frameData = canvas.toDataURL('image/jpeg', 0.8);

            // Send frame for depth processing
            const response = await fetch('/api/depth-camera/process-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frame: frameData })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success' && result.depth_frame) {
                this.displayDepthFrame(result.depth_frame);
                this.updateDepthStatus('Active');
                this.currentColormap = result.colormap || this.currentColormap;
                this.updateColormapDisplay();
            } else if (result.status === 'processing') {
                this.updateDepthStatus('Processing...');
            } else {
                console.warn('Depth processing issue:', result.message || result.status);
                this.updateDepthStatus('Error');
            }

        } catch (error) {
            console.error('Error processing depth frame:', error);
            this.updateDepthStatus('Error');
        } finally {
            this.isProcessing = false;
        }
    }

    displayDepthFrame(depthFrameData) {
        if (!this.depthCanvas || !this.depthContext) return;

        const img = new Image();
        img.onload = () => {
            // Get the video element to match its display size
            const video = document.getElementById('cameraVideo');
            if (video) {
                // Set canvas resolution to match image data
                this.depthCanvas.width = img.width;
                this.depthCanvas.height = img.height;
                
                // Ensure CSS size matches container (50% width, 450px height)
                this.depthCanvas.style.width = '50%';
                this.depthCanvas.style.height = '450px';
                this.depthCanvas.style.objectFit = 'cover';
                this.depthCanvas.style.objectPosition = 'center';
            }
            
            // Draw depth frame to fill the entire canvas
            this.depthContext.clearRect(0, 0, this.depthCanvas.width, this.depthCanvas.height);
            this.depthContext.drawImage(img, 0, 0, this.depthCanvas.width, this.depthCanvas.height);
        };
        
        img.onerror = (error) => {
            console.error('Error loading depth image:', error);
        };
        
        img.src = depthFrameData;
    }

    async changeColormap() {
        if (!this.isEnabled) return;

        try {
            const response = await fetch('/api/depth-camera/change-colormap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.currentColormap = result.colormap;
                this.updateColormapDisplay();
                console.log(`Colormap changed to: ${this.currentColormap}`);
            } else {
                console.error('Failed to change colormap:', result.message);
            }

        } catch (error) {
            console.error('Error changing colormap:', error);
        }
    }

    updateColormapDisplay() {
        const colormapDisplay = document.getElementById('currentColormap');
        if (colormapDisplay) {
            colormapDisplay.textContent = this.currentColormap;
        }
    }

    updateDepthStatus(status) {
        const statusDisplay = document.getElementById('depthProcessingStatus');
        if (statusDisplay) {
            statusDisplay.textContent = status;
        }
    }

    updateToggleButton(state, text) {
        const button = document.getElementById('depthCameraToggle');
        if (!button) return;

        // Remove all state classes
        button.classList.remove('btn-success', 'btn-danger', 'btn-warning', 'btn-secondary');

        switch (state) {
            case 'starting':
            case 'stopping':
                button.classList.add('btn-warning');
                button.disabled = true;
                button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${text}`;
                break;
            case 'active':
                button.classList.add('btn-danger');
                button.disabled = false;
                button.innerHTML = `<i class="fas fa-stop me-1"></i>${text}`;
                break;
            case 'inactive':
                button.classList.add('btn-success');
                button.disabled = false;
                button.innerHTML = `<i class="fas fa-eye me-1"></i>${text}`;
                break;
        }
    }

    showColormapButton() {
        const colormapBtn = document.getElementById('changeColormap');
        if (colormapBtn) {
            colormapBtn.style.display = 'inline-block';
        }
    }

    hideColormapButton() {
        const colormapBtn = document.getElementById('changeColormap');
        if (colormapBtn) {
            colormapBtn.style.display = 'none';
        }
    }

    updateDepthCameraStatus(enabled) {
        const statusBadge = document.getElementById('depthCameraStatus');
        if (statusBadge) {
            statusBadge.textContent = enabled ? 'Active' : 'Available';
            statusBadge.className = enabled ? 'badge bg-primary rounded-pill' : 'badge bg-success rounded-pill';
        }
    }

    showError(message) {
        // Create or update error notification
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 end-0 m-3';
        notification.style.zIndex = '1060';
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Depth Camera Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    handleDepthCameraError(error) {
        this.showError(error.message || 'Unknown error occurred');
        this.updateToggleButton('inactive', 'Start Depth Camera');
        this.isEnabled = false;
    }

    destroy() {
        this.stopFrameProcessing();
        this.disableSideBySideView();
        if (this.depthCanvas) {
            this.depthCanvas.remove();
        }
        this.removeDepthInfoOverlay();
    }
}

// Export for global use
if (typeof window !== 'undefined') {
    window.DepthCameraController = DepthCameraController;
} 