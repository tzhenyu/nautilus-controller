"""
Camera Configuration Settings
Contains all configurable parameters for camera operations and depth detection.
"""

import cv2


class CameraConfig:
    """Configuration class for camera settings."""
    
    # Camera device settings
    CAMERA_INDEX = 0
    FRAME_WIDTH = 640
    FRAME_HEIGHT = 480
    FPS = 30
    
    # Depth processing settings
    DEPTH_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"
    LOCAL_DEPTH_CHECKPOINT = "../checkpoints/depth_anything_v2_vitb.pth"
    DEPTH_COLORMAP = cv2.COLORMAP_PLASMA
    DEPTH_QUEUE_SIZE = 2
    DEPTH_PROCESS_INTERVAL = 0.1  # seconds
    
    # Display settings
    WINDOW_TITLE = "Camera vs Depth Detection"
    FONT = cv2.FONT_HERSHEY_SIMPLEX
    FONT_SCALE = 0.7
    FONT_COLOR = (255, 255, 255)
    FONT_THICKNESS = 2
    SEPARATOR_COLOR = (255, 255, 255)
    SEPARATOR_THICKNESS = 2
    
    # UI Labels
    NORMAL_CAMERA_LABEL = "Normal Camera"
    DEPTH_DETECTION_LABEL = "Depth Detection"
    PROCESSING_LABEL = "Processing..."
    
    # Controls help text
    CONTROLS_HELP = """
Controls:
  - Press 'q' to quit
  - Press 's' to save screenshot
  - Press 'r' to reset depth processing
  - Press 'c' to change colormap
  - Press 'h' to show/hide help
"""
    
    # Available colormaps for depth visualization
    AVAILABLE_COLORMAPS = [
        cv2.COLORMAP_PLASMA,
        cv2.COLORMAP_VIRIDIS,
        cv2.COLORMAP_JET,
        cv2.COLORMAP_HOT,
        cv2.COLORMAP_COOL,
        cv2.COLORMAP_SPRING,
        cv2.COLORMAP_SUMMER,
        cv2.COLORMAP_AUTUMN,
        cv2.COLORMAP_WINTER,
    ]
    
    COLORMAP_NAMES = [
        "Plasma",
        "Viridis", 
        "Jet",
        "Hot",
        "Cool",
        "Spring",
        "Summer",
        "Autumn",
        "Winter",
    ]


class PerformanceConfig:
    """Configuration for performance optimization."""
    
    # Threading settings
    ENABLE_THREADING = True
    THREAD_TIMEOUT = 2.0
    
    # Processing optimization
    SKIP_FRAMES = 0  # Skip N frames between depth processing
    MAX_PROCESSING_TIME = 1.0  # Maximum time for depth processing per frame
    
    # Memory management
    CLEAR_CACHE_INTERVAL = 100  # Clear processing cache every N frames


class DebugConfig:
    """Configuration for debugging and development."""
    
    ENABLE_FPS_COUNTER = True
    ENABLE_DEPTH_INFO = False
    ENABLE_PERFORMANCE_METRICS = False
    SAVE_DEBUG_FRAMES = False
    DEBUG_OUTPUT_DIR = "debug_output" 