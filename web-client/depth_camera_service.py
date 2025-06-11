"""
Depth Camera Service for Web Interface
Provides depth estimation as a web service for the Nautilus Controller UI.
"""

import cv2
import numpy as np
import base64
import threading
import time
import queue
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

try:
    from utils.depth_processor import DepthProcessor
    from config.camera_config import CameraConfig
    DEPTH_PROCESSOR_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Depth processor not available: {e}")
    DEPTH_PROCESSOR_AVAILABLE = False


class DepthCameraService:
    """
    Web service for depth camera functionality.
    Processes frames from the normal camera and provides depth estimation.
    """
    
    def __init__(self):
        """Initialize the depth camera service."""
        self.depth_processor = None
        self.is_enabled = False
        self.is_processing = False
        self.last_depth_frame = None
        self.last_normal_frame = None
        self.processing_thread = None
        self.frame_queue = queue.Queue(maxsize=2)
        self.depth_queue = queue.Queue(maxsize=2)
        self.current_colormap_index = 0
        
        # Initialize depth processor if available
        if DEPTH_PROCESSOR_AVAILABLE:
            self._initialize_depth_processor()
    
    def _initialize_depth_processor(self):
        """Initialize the depth processor."""
        try:
            self.depth_processor = DepthProcessor(
                model_name=CameraConfig.DEPTH_MODEL,
                local_checkpoint=CameraConfig.LOCAL_DEPTH_CHECKPOINT
            )
            success = self.depth_processor.load_model()
            if not success:
                self.depth_processor = None
                print("Failed to load depth model")
        except Exception as e:
            print(f"Error initializing depth processor: {e}")
            self.depth_processor = None
    
    def is_available(self):
        """Check if depth camera service is available."""
        return DEPTH_PROCESSOR_AVAILABLE and self.depth_processor is not None
    
    def start_depth_processing(self):
        """Start depth camera processing."""
        if not self.is_available():
            return {"status": "error", "message": "Depth processing not available"}
        
        if self.is_enabled:
            return {"status": "error", "message": "Depth processing already running"}
        
        try:
            self.is_enabled = True
            self.is_processing = True
            
            # Start processing thread
            self.processing_thread = threading.Thread(target=self._depth_processing_worker)
            self.processing_thread.daemon = True
            self.processing_thread.start()
            
            return {"status": "success", "message": "Depth processing started"}
            
        except Exception as e:
            self.is_enabled = False
            self.is_processing = False
            return {"status": "error", "message": f"Failed to start depth processing: {str(e)}"}
    
    def stop_depth_processing(self):
        """Stop depth camera processing."""
        try:
            self.is_enabled = False
            self.is_processing = False
            
            if self.processing_thread and self.processing_thread.is_alive():
                self.processing_thread.join(timeout=2.0)
            
            # Clear queues
            self._clear_queue(self.frame_queue)
            self._clear_queue(self.depth_queue)
            
            self.last_depth_frame = None
            self.last_normal_frame = None
            
            return {"status": "success", "message": "Depth processing stopped"}
            
        except Exception as e:
            return {"status": "error", "message": f"Failed to stop depth processing: {str(e)}"}
    
    def _clear_queue(self, q):
        """Clear a queue."""
        while not q.empty():
            try:
                q.get(block=False)
            except queue.Empty:
                break
    
    def process_frame(self, frame_data):
        """
        Process a frame for depth estimation.
        
        Args:
            frame_data: Base64 encoded frame data
            
        Returns:
            dict: Processing result with depth frame
        """
        if not self.is_enabled or not self.is_available():
            return {"status": "error", "message": "Depth processing not enabled or available"}
        
        try:
            # Decode frame
            frame = self._decode_frame(frame_data)
            if frame is None:
                return {"status": "error", "message": "Failed to decode frame"}
            
            # Add frame to processing queue (non-blocking)
            try:
                self.frame_queue.put(frame, block=False)
            except queue.Full:
                # Remove old frame and add new one
                try:
                    self.frame_queue.get(block=False)
                    self.frame_queue.put(frame, block=False)
                except queue.Empty:
                    pass
            
            # Get latest depth frame if available
            depth_frame_b64 = None
            try:
                while not self.depth_queue.empty():
                    depth_frame_b64 = self.depth_queue.get(block=False)
            except queue.Empty:
                pass
            
            # Return the latest depth frame or placeholder
            if depth_frame_b64:
                return {
                    "status": "success", 
                    "depth_frame": depth_frame_b64,
                    "colormap": CameraConfig.COLORMAP_NAMES[self.current_colormap_index]
                }
            else:
                return {"status": "processing", "message": "Depth frame being processed"}
                
        except Exception as e:
            return {"status": "error", "message": f"Frame processing error: {str(e)}"}
    
    def _depth_processing_worker(self):
        """Background worker for depth processing."""
        while self.is_enabled:
            try:
                # Get frame from queue
                try:
                    frame = self.frame_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                
                # Process depth
                if self.depth_processor:
                    current_colormap = CameraConfig.AVAILABLE_COLORMAPS[self.current_colormap_index]
                    self.depth_processor.set_colormap(current_colormap)
                    depth_frame = self.depth_processor.process_frame(frame)
                    
                    if depth_frame is not None:
                        # Encode depth frame
                        depth_frame_b64 = self._encode_frame(depth_frame)
                        
                        # Add to depth queue (non-blocking)
                        try:
                            self.depth_queue.put(depth_frame_b64, block=False)
                        except queue.Full:
                            # Remove old depth frame and add new one
                            try:
                                self.depth_queue.get(block=False)
                                self.depth_queue.put(depth_frame_b64, block=False)
                            except queue.Empty:
                                pass
                
                # Small delay to control processing rate
                time.sleep(CameraConfig.DEPTH_PROCESS_INTERVAL)
                
            except Exception as e:
                print(f"Error in depth processing worker: {e}")
                time.sleep(1)
    
    def change_colormap(self):
        """Change the depth visualization colormap."""
        if not self.is_available():
            return {"status": "error", "message": "Depth processing not available"}
        
        try:
            self.current_colormap_index = (self.current_colormap_index + 1) % len(CameraConfig.AVAILABLE_COLORMAPS)
            colormap_name = CameraConfig.COLORMAP_NAMES[self.current_colormap_index]
            
            return {
                "status": "success", 
                "colormap": colormap_name,
                "index": self.current_colormap_index
            }
            
        except Exception as e:
            return {"status": "error", "message": f"Failed to change colormap: {str(e)}"}
    
    def get_status(self):
        """Get current depth camera status."""
        return {
            "available": self.is_available(),
            "enabled": self.is_enabled,
            "processing": self.is_processing,
            "colormap": CameraConfig.COLORMAP_NAMES[self.current_colormap_index] if self.is_available() else None,
            "colormap_index": self.current_colormap_index if self.is_available() else None,
            "available_colormaps": CameraConfig.COLORMAP_NAMES if self.is_available() else []
        }
    
    def _decode_frame(self, frame_data):
        """Decode base64 frame data to numpy array."""
        try:
            # Remove data URL prefix if present
            if frame_data.startswith('data:image'):
                frame_data = frame_data.split(',')[1]
            
            # Decode base64
            img_data = base64.b64decode(frame_data)
            
            # Convert to numpy array
            nparr = np.frombuffer(img_data, np.uint8)
            
            # Decode image
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            return frame
            
        except Exception as e:
            print(f"Error decoding frame: {e}")
            return None
    
    def _encode_frame(self, frame):
        """Encode numpy array frame to base64."""
        try:
            # Encode frame as JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            
            # Convert to base64
            frame_b64 = base64.b64encode(buffer).decode('utf-8')
            
            return f"data:image/jpeg;base64,{frame_b64}"
            
        except Exception as e:
            print(f"Error encoding frame: {e}")
            return None


# Global service instance
depth_camera_service = DepthCameraService() 