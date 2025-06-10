/**
 * Depth Controller for Real-time Depth Estimation
 * Integrates with CameraController to provide depth mapping using Depth Anything V2
 */
class DepthController {
    constructor(cameraController) {
        this.cameraController = cameraController;
        this.isDepthEnabled = false;
        this.depthCanvas = null;
        this.depthContext = null;
        this.processingFrame = false;
        this.depthUpdateInterval = null;
        this.lastProcessedTime = 0;
        this.processingFPS = 2; // Process depth every 500ms for better performance
        
        this.init();
    }

    init() {
        this.setupDepthCanvas();
        this.setupEventListeners();
        this.checkBackendAvailability();
    }

    setupDepthCanvas() {
        // Create depth canvas element
        this.depthCanvas = document.createElement('canvas');
        this.depthCanvas.id = 'depthCanvas';
        this.depthCanvas.style.width = '100%';
        this.depthCanvas.style.height = '100%';
        this.depthCanvas.style.objectFit = 'cover';
        this.depthContext = this.depthCanvas.getContext('2d');
    }

    setupEventListeners() {
        // Depth toggle button
        const depthToggleBtn = document.getElementById('depthToggle');
        if (depthToggleBtn) {
            depthToggleBtn.addEventListener('click', () => this.toggleDepth());
        }

        // Depth mode selector
        const depthModeSelect = document.getElementById('depthMode');
        if (depthModeSelect) {
            depthModeSelect.addEventListener('change', (e) => this.setDepthMode(e.target.value));
        }
    }

    async checkBackendAvailability() {
        try {
            const response = await fetch('/api/depth/status');
            const data = await response.json();
            this.updateDepthStatus(data.available);
        } catch (error) {
            console.warn('Depth backend not available:', error);
            this.updateDepthStatus(false);
        }
    }

    async toggleDepth() {
        if (!this.cameraController.isActive) {
            this.showDepthError('Camera must be active to use depth estimation. Please start the camera first.');
            return;
        }

        if (this.isDepthEnabled) {
            await this.stopDepth();
        } else {
            await this.startDepth();
        }
    }

    async startDepth() {
        try {
            this.updateDepthButton('starting', 'Starting Depth...');
            
            // Show depth view
            this.showDepthView();
            
            // Start depth processing
            this.startDepthProcessing();
            
            this.isDepthEnabled = true;
            this.updateDepthButton('active', 'Stop Depth');
            this.updateDepthStatus(true);
            
            console.log('Depth estimation started');
            
        } catch (error) {
            console.error('Error starting depth estimation:', error);
            this.handleDepthError(error);
        }
    }

    async stopDepth() {
        try {
            this.updateDepthButton('stopping', 'Stopping...');
            
            // Stop depth processing
            this.stopDepthProcessing();
            
            // Hide depth view
            this.hideDepthView();
            
            this.isDepthEnabled = false;
            this.updateDepthButton('inactive', 'Start Depth');
            this.updateDepthStatus(false);
            
            console.log('Depth estimation stopped');
            
        } catch (error) {
            console.error('Error stopping depth estimation:', error);
        }
    }

    // Method for external stopping (when camera is stopped)
    async autoStopDepth() {
        if (!this.isDepthEnabled) return;
        
        try {
            console.log('📹 Depth estimation auto-stopped (camera dependency)');
            
            // Stop depth processing immediately
            this.stopDepthProcessing();
            
            // Hide depth view
            this.hideDepthView();
            
            this.isDepthEnabled = false;
            this.updateDepthButton('inactive', 'Start Depth');
            this.updateDepthStatus(false);
            
            // Silent auto-stop - no UI notification needed
            
        } catch (error) {
            console.error('Error auto-stopping depth estimation:', error);
        }
    }

    startDepthProcessing() {
        if (this.depthUpdateInterval) {
            clearInterval(this.depthUpdateInterval);
        }

        this.depthUpdateInterval = setInterval(() => {
            if (this.isDepthEnabled && !this.processingFrame) {
                this.processCurrentFrame();
            }
        }, 1000 / this.processingFPS);
    }

    stopDepthProcessing() {
        if (this.depthUpdateInterval) {
            clearInterval(this.depthUpdateInterval);
            this.depthUpdateInterval = null;
        }
        this.processingFrame = false;
    }

    async processCurrentFrame() {
        if (!this.cameraController.video || this.processingFrame) return;

        try {
            this.processingFrame = true;
            console.log('🔍 Processing depth frame...');
            
            // Capture current frame from video
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = this.cameraController.video.videoWidth;
            canvas.height = this.cameraController.video.videoHeight;
            
            context.drawImage(this.cameraController.video, 0, 0);
            console.log(`📸 Captured frame: ${canvas.width}x${canvas.height}`);
            
            // Convert to blob and send to backend
            canvas.toBlob(async (blob) => {
                try {
                    console.log(`📤 Sending ${blob.size} bytes to depth API...`);
                    const formData = new FormData();
                    formData.append('image', blob, 'frame.jpg');
                    
                    const response = await fetch('/api/depth/process', {
                        method: 'POST',
                        body: formData
                    });
                    
                    console.log(`📥 Depth API response: ${response.status} ${response.statusText}`);
                    
                    if (response.ok) {
                        const depthBlob = await response.blob();
                        console.log(`✅ Received depth map: ${depthBlob.size} bytes`);
                        this.displayDepthMap(depthBlob);
                    } else {
                        const errorText = await response.text();
                        console.error('❌ Depth processing failed:', response.statusText, errorText);
                    }
                } catch (error) {
                    console.error('❌ Error processing depth:', error);
                } finally {
                    this.processingFrame = false;
                }
            }, 'image/jpeg', 0.8);
            
        } catch (error) {
            console.error('❌ Error capturing frame:', error);
            this.processingFrame = false;
        }
    }

    displayDepthMap(depthBlob) {
        const img = new Image();
        img.onload = () => {
            if (this.depthCanvas && this.depthContext) {
                this.depthCanvas.width = img.width;
                this.depthCanvas.height = img.height;
                this.depthContext.drawImage(img, 0, 0);
            }
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(depthBlob);
    }

    showDepthView() {
        const depthContainer = document.getElementById('depthContainer');
        
        if (depthContainer) {
            // Show depth container and add canvas
            depthContainer.style.display = 'flex';
            depthContainer.appendChild(this.depthCanvas);
            
            // Update layout to enable grid view
            this.updateDepthLayout();
        }
    }

    hideDepthView() {
        const depthContainer = document.getElementById('depthContainer');
        const cameraContainer = document.querySelector('.camera-container-enhanced');
        
        if (depthContainer) {
            // Hide depth container
            depthContainer.style.display = 'none';
            
            // Clear depth canvas
            if (this.depthContext) {
                this.depthContext.clearRect(0, 0, this.depthCanvas.width, this.depthCanvas.height);
            }
        }
        
        if (cameraContainer) {
            // Remove depth mode class to return to normal view
            cameraContainer.classList.remove('depth-mode-side-by-side');
        }
    }

    updateDepthLayout() {
        const depthMode = document.getElementById('depthMode')?.value || 'side-by-side';
        const cameraContainer = document.querySelector('.camera-container-enhanced');
        
        if (cameraContainer) {
            cameraContainer.className = `camera-container-enhanced depth-mode-${depthMode}`;
        }
    }

    setDepthMode(mode) {
        this.updateDepthLayout();
        console.log('Depth mode set to:', mode);
    }

    updateDepthButton(state, text) {
        const depthBtn = document.getElementById('depthToggle');
        const depthText = document.getElementById('depthToggleText');
        
        if (!depthBtn || !depthText) return;

        depthBtn.disabled = state === 'starting' || state === 'stopping';
        depthText.textContent = text;
        
        // Update button style based on state
        depthBtn.className = 'btn btn-sm rounded-pill depth-btn ';
        switch (state) {
            case 'active':
                depthBtn.className += 'btn-warning';
                break;
            case 'inactive':
                depthBtn.className += 'btn-info';
                break;
            case 'starting':
                depthBtn.className += 'btn-secondary';
                break;
            case 'stopping':
                depthBtn.className += 'btn-secondary';
                break;
        }
    }

    updateDepthStatus(enabled) {
        const statusElement = document.getElementById('depthStatus');
        if (statusElement) {
            statusElement.textContent = enabled ? 'ON' : 'OFF';
            statusElement.className = `badge ${enabled ? 'bg-info' : 'bg-secondary'} rounded-pill`;
        }

        // Update processing indicator
        const processingElement = document.getElementById('depthProcessing');
        if (processingElement) {
            processingElement.style.display = enabled && this.processingFrame ? 'block' : 'none';
        }
    }

    showDepthError(message) {
        // Create or update error notification
        const errorDiv = document.getElementById('depthError') || document.createElement('div');
        errorDiv.id = 'depthError';
        errorDiv.className = 'alert alert-warning alert-dismissible fade show';
        errorDiv.innerHTML = `
            <strong>Depth Error:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert error message
        const container = document.querySelector('.camera-container-enhanced') || document.body;
        container.insertBefore(errorDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    showDepthInfo(message) {
        // Create or update info notification
        const infoDiv = document.getElementById('depthInfo') || document.createElement('div');
        infoDiv.id = 'depthInfo';
        infoDiv.className = 'alert alert-info alert-dismissible fade show';
        infoDiv.innerHTML = `
            <strong>Depth Info:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert info message
        const container = document.querySelector('.camera-container-enhanced') || document.body;
        container.insertBefore(infoDiv, container.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (infoDiv.parentNode) {
                infoDiv.remove();
            }
        }, 3000);
    }

    handleDepthError(error) {
        let errorMessage = 'Depth estimation failed';
        
        if (error.message) {
            errorMessage = error.message;
        }
        
        this.showDepthError(errorMessage);
        this.updateDepthButton('inactive', 'Start Depth');
        this.updateDepthStatus(false);
        this.isDepthEnabled = false;
    }

    // Get depth estimation statistics
    getDepthStats() {
        return {
            enabled: this.isDepthEnabled,
            processing: this.processingFrame,
            fps: this.processingFPS,
            lastProcessed: this.lastProcessedTime
        };
    }

    // Clean up resources
    destroy() {
        this.stopDepthProcessing();
        
        if (this.depthCanvas && this.depthCanvas.parentNode) {
            this.depthCanvas.parentNode.removeChild(this.depthCanvas);
        }
        
        this.depthCanvas = null;
        this.depthContext = null;
        this.isDepthEnabled = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DepthController;
} 