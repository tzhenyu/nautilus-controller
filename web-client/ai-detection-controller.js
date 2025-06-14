/**
 * AI Detection Controller for Nautilus Controller
 * Handles AI object detection integration with camera feed
 */
class AIDetectionController {
    constructor() {
        this.isEnabled = false;
        this.isProcessing = false;
        this.detectionInterval = null;
        this.detectionCanvas = null;
        this.confidenceThreshold = 0.5;
        this.processFrameRate = 2; // Process every 2 frames for performance
        this.frameCounter = 0;
        this.lastDetections = [];
        this.detectionOverlay = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createDetectionOverlay();
        this.checkServiceAvailability();
    }

    setupEventListeners() {
        // AI Detection toggle button
        const toggleBtn = document.getElementById('aiDetectionToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleDetection());
        }

        // Confidence threshold slider
        const confidenceSlider = document.getElementById('confidenceSlider');
        if (confidenceSlider) {
            confidenceSlider.addEventListener('input', (e) => {
                this.setConfidenceThreshold(parseFloat(e.target.value));
            });
        }

        // Reset detections button
        const resetBtn = document.getElementById('resetDetections');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.clearDetections());
        }
    }

    async checkServiceAvailability() {
        try {
            const response = await fetch('/api/ai-detection/status');
            const data = await response.json();
            
            if (response.ok) {
                this.updateAvailabilityUI(true);
                console.log('AI Detection service is available');
            } else {
                this.updateAvailabilityUI(false);
                console.warn('AI Detection service is not available:', data.message);
            }
        } catch (error) {
            console.error('Error checking AI detection service:', error);
            this.updateAvailabilityUI(false);
        }
    }

    updateAvailabilityUI(available) {
        const toggleBtn = document.getElementById('aiDetectionToggle');
        const statusIndicator = document.getElementById('aiDetectionStatus');
        
        if (toggleBtn) {
            toggleBtn.disabled = !available;
            if (!available) {
                toggleBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Unavailable';
                toggleBtn.className = 'btn btn-secondary btn-sm rounded-pill';
            }
        }

        if (statusIndicator) {
            statusIndicator.textContent = available ? 'Available' : 'Unavailable';
            statusIndicator.className = available ? 'badge bg-success rounded-pill' : 'badge bg-danger rounded-pill';
        }
    }

    createDetectionOverlay() {
        const cameraContainer = document.getElementById('cameraContainer');
        if (!cameraContainer) return;

        // Create detection overlay
        this.detectionOverlay = document.createElement('div');
        this.detectionOverlay.id = 'aiDetectionOverlay';
        this.detectionOverlay.className = 'ai-detection-overlay';
        this.detectionOverlay.style.display = 'none';
        
        // Create detection canvas for drawing bounding boxes
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCanvas.className = 'detection-canvas';
        this.detectionOverlay.appendChild(this.detectionCanvas);

        // Create detection info panel
        const infoPanel = document.createElement('div');
        infoPanel.className = 'detection-info-panel';
        infoPanel.innerHTML = `
            <div class="detection-stats">
                <span class="detection-count">Objects: <span id="detectionCount">0</span></span>
                <span class="detection-fps">AI FPS: <span id="detectionFPS">0</span></span>
            </div>
            <div class="detected-objects" id="detectedObjects"></div>
        `;
        this.detectionOverlay.appendChild(infoPanel);

        cameraContainer.appendChild(this.detectionOverlay);
    }

    async toggleDetection() {
        if (this.isEnabled) {
            await this.stopDetection();
        } else {
            await this.startDetection();
        }
    }

    async startDetection() {
        try {
            this.updateToggleButton('starting', 'Starting...');

            // Check if camera is active
            if (!window.controller || !window.controller.cameraController || !window.controller.cameraController.isActive) {
                this.showError('Camera must be active to start AI detection');
                this.updateToggleButton('inactive', 'Start AI Detection');
                return;
            }

            // Enable detection on server
            const response = await fetch('/api/ai-detection/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                this.isEnabled = true;
                this.showDetectionOverlay();
                this.startFrameProcessing();
                this.updateToggleButton('active', 'Stop AI Detection');
                this.updateDetectionStatus(true);
                console.log('AI detection started successfully');
            } else {
                throw new Error(data.message || 'Failed to start AI detection');
            }

        } catch (error) {
            console.error('Error starting AI detection:', error);
            this.handleDetectionError(error);
        }
    }

    async stopDetection() {
        try {
            this.updateToggleButton('stopping', 'Stopping...');

            // Disable detection on server
            const response = await fetch('/api/ai-detection/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                this.isEnabled = false;
                this.stopFrameProcessing();
                this.hideDetectionOverlay();
                this.clearDetections();
                this.updateToggleButton('inactive', 'Start AI Detection');
                this.updateDetectionStatus(false);
                console.log('AI detection stopped successfully');
            } else {
                throw new Error(data.message || 'Failed to stop AI detection');
            }

        } catch (error) {
            console.error('Error stopping AI detection:', error);
            this.updateToggleButton('inactive', 'Start AI Detection');
        }
    }

    startFrameProcessing() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }

        this.detectionInterval = setInterval(() => {
            if (this.isEnabled && !this.isProcessing) {
                this.frameCounter++;
                if (this.frameCounter % this.processFrameRate === 0) {
                    this.processCurrentFrame();
                }
            }
        }, 100); // Check every 100ms
    }

    stopFrameProcessing() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        this.frameCounter = 0;
    }

    async processCurrentFrame() {
        try {
            this.isProcessing = true;

            // Get current frame from camera
            const video = document.getElementById('cameraVideo');
            if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
                this.isProcessing = false;
                return;
            }

            // Capture frame to canvas
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            // Convert to base64
            const base64Frame = canvas.toDataURL('image/jpeg', 0.8);

            // Send to server for processing
            const response = await fetch('/api/ai-detection/process-frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frame: base64Frame })
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                this.updateDetections(data.detections, data.summary, data.ai_status);
            } else {
                console.warn('Detection processing failed:', data.message);
            }

        } catch (error) {
            console.error('Error processing frame:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    updateDetections(detections, summary, aiStatus) {
        this.lastDetections = detections;
        
        // Update detection count
        const countElement = document.getElementById('detectionCount');
        if (countElement) {
            countElement.textContent = summary.total_objects || 0;
        }

        // Update FPS
        const fpsElement = document.getElementById('detectionFPS');
        if (fpsElement && aiStatus) {
            fpsElement.textContent = aiStatus.detection_fps?.toFixed(1) || '0.0';
        }

        // Update detected objects list
        this.updateDetectedObjectsList(summary.classes || {});

        // Draw bounding boxes on overlay canvas
        this.drawDetections(detections);
    }

    updateDetectedObjectsList(classes) {
        const objectsContainer = document.getElementById('detectedObjects');
        if (!objectsContainer) return;

        objectsContainer.innerHTML = '';

        Object.entries(classes).forEach(([className, count]) => {
            const objectItem = document.createElement('div');
            objectItem.className = 'detected-object-item';
            objectItem.innerHTML = `
                <span class="object-name">${className}</span>
                <span class="object-count badge bg-primary rounded-pill">${count}</span>
            `;
            objectsContainer.appendChild(objectItem);
        });
    }

    drawDetections(detections) {
        if (!this.detectionCanvas || !detections.length) {
            this.clearCanvas();
            return;
        }

        const video = document.getElementById('cameraVideo');
        if (!video) return;

        // Resize canvas to match video display size
        const rect = video.getBoundingClientRect();
        this.detectionCanvas.width = rect.width;
        this.detectionCanvas.height = rect.height;

        const ctx = this.detectionCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        // Calculate scaling factors
        const scaleX = rect.width / video.videoWidth;
        const scaleY = rect.height / video.videoHeight;

        detections.forEach((detection, index) => {
            const [x1, y1, x2, y2] = detection.bbox;
            
            // Scale coordinates
            const scaledX1 = x1 * scaleX;
            const scaledY1 = y1 * scaleY;
            const scaledX2 = x2 * scaleX;
            const scaledY2 = y2 * scaleY;

            // Generate color based on class
            const color = this.getClassColor(detection.class_id);

            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(scaledX1, scaledY1, scaledX2 - scaledX1, scaledY2 - scaledY1);

            // Draw label background
            const label = `${detection.class_name}: ${(detection.confidence * 100).toFixed(1)}%`;
            ctx.font = '14px Arial';
            const labelWidth = ctx.measureText(label).width;
            const labelHeight = 20;

            ctx.fillStyle = color;
            ctx.fillRect(scaledX1, scaledY1 - labelHeight, labelWidth + 8, labelHeight);

            // Draw label text
            ctx.fillStyle = 'white';
            ctx.fillText(label, scaledX1 + 4, scaledY1 - 6);
        });
    }

    clearCanvas() {
        if (this.detectionCanvas) {
            const ctx = this.detectionCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        }
    }

    getClassColor(classId) {
        // Generate consistent colors for classes
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#F9CA24', '#F0932B',
            '#EB4D4B', '#6C5CE7', '#A29BFE', '#FD79A8', '#00B894'
        ];
        return colors[classId % colors.length];
    }

    async setConfidenceThreshold(threshold) {
        try {
            const response = await fetch('/api/ai-detection/set-confidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threshold })
            });

            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                this.confidenceThreshold = threshold;
                console.log(`Confidence threshold set to ${threshold}`);
                
                // Update UI
                const valueDisplay = document.getElementById('confidenceValue');
                if (valueDisplay) {
                    valueDisplay.textContent = `${(threshold * 100).toFixed(0)}%`;
                }
            } else {
                console.error('Failed to set confidence threshold:', data.message);
            }

        } catch (error) {
            console.error('Error setting confidence threshold:', error);
        }
    }

    clearDetections() {
        this.lastDetections = [];
        this.clearCanvas();
        
        const countElement = document.getElementById('detectionCount');
        if (countElement) countElement.textContent = '0';
        
        const objectsContainer = document.getElementById('detectedObjects');
        if (objectsContainer) objectsContainer.innerHTML = '';
    }

    showDetectionOverlay() {
        if (this.detectionOverlay) {
            this.detectionOverlay.style.display = 'block';
        }
    }

    hideDetectionOverlay() {
        if (this.detectionOverlay) {
            this.detectionOverlay.style.display = 'none';
        }
    }

    updateToggleButton(state, text) {
        const toggleBtn = document.getElementById('aiDetectionToggle');
        if (!toggleBtn) return;

        toggleBtn.disabled = (state === 'starting' || state === 'stopping');
        
        const buttonClasses = {
            'inactive': 'btn btn-success btn-sm rounded-pill',
            'active': 'btn btn-danger btn-sm rounded-pill', 
            'starting': 'btn btn-warning btn-sm rounded-pill',
            'stopping': 'btn btn-warning btn-sm rounded-pill'
        };

        const buttonIcons = {
            'inactive': 'fas fa-robot',
            'active': 'fas fa-robot',
            'starting': 'fas fa-spinner fa-spin',
            'stopping': 'fas fa-spinner fa-spin'
        };

        toggleBtn.className = buttonClasses[state] || buttonClasses.inactive;
        toggleBtn.innerHTML = `<i class="${buttonIcons[state]} me-1"></i><span>${text}</span>`;
    }

    updateDetectionStatus(enabled) {
        const statusElement = document.getElementById('aiDetectionStatusBadge');
        if (statusElement) {
            statusElement.textContent = enabled ? 'ON' : 'OFF';
            statusElement.className = enabled ? 'badge bg-success rounded-pill' : 'badge bg-danger rounded-pill';
        }
    }

    showError(message) {
        console.error('AI Detection Error:', message);
        // You can implement a user-friendly error display here
        const errorContainer = document.getElementById('aiDetectionError');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }

    handleDetectionError(error) {
        this.isEnabled = false;
        this.stopFrameProcessing();
        this.hideDetectionOverlay();
        this.updateToggleButton('inactive', 'Start AI Detection');
        this.updateDetectionStatus(false);
        this.showError(error.message || 'AI detection error occurred');
    }

    destroy() {
        this.stopFrameProcessing();
        if (this.detectionOverlay) {
            this.detectionOverlay.remove();
        }
    }
}

// Export for use in main application
window.AIDetectionController = AIDetectionController;
