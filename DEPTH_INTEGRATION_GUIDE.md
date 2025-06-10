# Depth Anything V2 Integration Guide

This guide explains how to integrate real-time depth estimation with your Nautilus camera controller using Depth Anything V2.

## 🚀 Quick Setup

### 1. Install Dependencies

First, make sure you have all required dependencies:

```bash
# Install Python dependencies
pip install torch torchvision opencv-python matplotlib pillow

# The existing requirements.txt already includes most dependencies
pip install -r requirements.txt
```

### 2. Download Model Weights

Run the download script to get the pre-trained Depth Anything V2 model:

```bash
python download_depth_model.py
```
> Put the model inside checkpoints folder

**Model Options:**
- `vits` - Small model (~400MB, faster inference)
- `vitb` - Base model (~800MB, balanced)
- `vitl` - Large model (~1.3GB, best accuracy) **[Recommended]**

### 3. Start the Server

```bash
cd web-client
python backend.py
```

The server will automatically detect and enable depth estimation if the models are available.

### 4. Access the Interface

Open your browser and navigate to: `http://localhost:8000`

## 🎮 How to Use

### Camera + Depth Controls

1. **Start Camera**: Click the green "Start Camera" button or press `C`
2. **Enable Depth**: Click the blue "Start Depth" button or press `D`
3. **View Modes**: The depth map will appear side-by-side with the camera feed

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `C` | Toggle camera on/off |
| `D` | Toggle depth estimation |
| `F` | Toggle fullscreen |
| `Esc` | Exit fullscreen |

## 🔧 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Camera Feed   │────│  Depth Service  │────│   Depth Map     │
│   (WebRTC)      │    │ (Depth Anything │    │ (Visualization) │
│                 │    │     V2)         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components Added:

1. **`depth_service.py`** - Backend depth estimation service
2. **`depth-controller.js`** - Frontend depth processing
3. **Enhanced UI** - Depth controls and visualization
4. **API Endpoints**:
   - `GET /api/depth/status` - Check service availability
   - `POST /api/depth/process` - Process camera frames

## 🎨 Features

### Real-time Processing
- Processes camera frames at ~2 FPS for optimal performance
- Asynchronous processing to avoid blocking camera feed
- Visual indicators for processing status

### Visualization Options
- **Side-by-side view**: Camera feed + depth map
- **Colorized depth**: Spectral colormap for depth visualization
- **Grayscale mode**: Available via API settings

### Smart Integration
- Automatically shows depth controls when camera is active
- Graceful degradation if depth service is unavailable
- Error handling with user-friendly messages

## 🛠️ Advanced Configuration

### Model Selection

Edit `depth_service.py` to change the model:

```python
# Initialize with different model
depth_service = DepthEstimationService(
    encoder='vitl',      # vits, vitb, vitl, vitg
    max_depth=20,        # Maximum depth in meters
    input_size=518       # Input resolution
)
```

### Performance Tuning

Adjust processing frequency in `depth-controller.js`:

```javascript
this.processingFPS = 2; // Lower for better performance
```

### Custom Visualization

Modify depth visualization in `depth_service.py`:

```python
# Use grayscale instead of color
service.set_grayscale_mode(True)
```

## 🚨 Troubleshooting

### Common Issues

**"Depth service not available"**
- Ensure `torch` and `depth_anything_v2` are installed
- Check if model weights are downloaded
- Verify `depth_service.py` imports correctly

**Slow performance**
- Reduce `processingFPS` in `depth-controller.js`
- Use smaller model (`vits` instead of `vitl`)
- Close other applications using GPU

**Memory errors**
- Use CPU instead of GPU (automatic fallback)
- Reduce input resolution in `depth_service.py`
- Use smaller model variant

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📝 API Reference

### Depth Service Endpoints

```http
GET /api/depth/status
# Returns: {"available": true, "encoder": "vitl", "device": "cuda"}

POST /api/depth/process
Content-Type: multipart/form-data
# Body: image file
# Returns: PNG depth visualization

POST /api/depth/settings
Content-Type: application/json
# Body: {"grayscale": true}
```

## 🔄 Integration Flow

1. **Camera Controller** captures video frames
2. **Depth Controller** extracts frames periodically
3. **Backend Service** processes frames with Depth Anything V2
4. **Visualization** displays colorized depth maps
5. **UI Updates** in real-time with status indicators

## 🎯 Performance Tips

- **GPU Usage**: CUDA/MPS automatically detected for acceleration
- **Memory**: Models are loaded once and reused
- **Batching**: Single frame processing for real-time performance
- **Threading**: Asynchronous processing prevents UI blocking

## 📊 Model Comparison

| Model | Size | Speed | Accuracy | Recommended For |
|-------|------|-------|----------|-----------------|
| vits  | 400MB | Fast | Good | Real-time, mobile |
| vitb  | 800MB | Medium | Better | Balanced use |
| vitl  | 1.3GB | Slower | Best | High quality |

---

**Ready to explore depth perception with your Nautilus robot! 🤖🔍** 