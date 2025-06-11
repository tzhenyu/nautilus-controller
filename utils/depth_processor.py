"""
Depth Processing Utilities
This module contains utilities for depth estimation and visualization.
"""

import numpy as np
import cv2
from PIL import Image
from transformers import pipeline
import torch
import os
import sys

# Add the depth_anything_v2 module to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from depth_anything_v2.dpt import DepthAnythingV2
    DEPTH_ANYTHING_V2_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Depth-Anything-V2 local model not available: {e}")
    DEPTH_ANYTHING_V2_AVAILABLE = False


class DepthProcessor:
    """
    Handles depth estimation processing and visualization.
    """
    
    def __init__(self, model_name="depth-anything/Depth-Anything-V2-Small-hf", local_checkpoint=None):
        """
        Initialize the depth processor.
        
        Args:
            model_name: HuggingFace model name for depth estimation
            local_checkpoint: Path to local model checkpoint file
        """
        self.model_name = model_name
        self.local_checkpoint = local_checkpoint
        self.pipeline = None
        self.model = None
        self.is_loaded = False
        self.use_local = False
        self.current_colormap = cv2.COLORMAP_PLASMA
        
    def load_model(self):
        """
        Load the depth estimation model.
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        # Try loading local checkpoint first if available
        if self.local_checkpoint and os.path.exists(self.local_checkpoint):
            try:
                print(f"Loading local depth model: {self.local_checkpoint}")
                return self._load_local_model()
            except Exception as e:
                print(f"✗ Error loading local model: {e}")
                print("Falling back to HuggingFace model...")
        
        # Fallback to HuggingFace pipeline
        try:
            print(f"Loading depth model from HuggingFace: {self.model_name}")
            self.pipeline = pipeline(
                task="depth-estimation", 
                model=self.model_name
            )
            self.use_local = False
            self.is_loaded = True
            print("✓ Depth model loaded successfully")
            return True
        except Exception as e:
            print(f"✗ Error loading depth model: {e}")
            self.is_loaded = False
            return False
            
    def _load_local_model(self):
        """
        Load depth model from local checkpoint.
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        if not DEPTH_ANYTHING_V2_AVAILABLE:
            print("✗ Depth-Anything-V2 architecture not available")
            return False
            
        try:
            # Determine model configuration based on checkpoint filename
            if 'vitb' in self.local_checkpoint:
                encoder = 'vitb'
                features = 128
                out_channels = [96, 192, 384, 768]
            elif 'vits' in self.local_checkpoint:
                encoder = 'vits'
                features = 64
                out_channels = [48, 96, 192, 384]
            elif 'vitl' in self.local_checkpoint:
                encoder = 'vitl'
                features = 256
                out_channels = [256, 512, 1024, 1024]
            else:
                # Default to vitb configuration
                print("⚠️  Unknown model type, defaulting to vitb configuration")
                encoder = 'vitb'
                features = 128
                out_channels = [96, 192, 384, 768]
            
            print(f"Creating DepthAnythingV2 model with encoder: {encoder}")
            
            # Create the model
            self.model = DepthAnythingV2(
                encoder=encoder,
                features=features,
                out_channels=out_channels
            )
            
            # Load the checkpoint
            print(f"Loading checkpoint: {self.local_checkpoint}")
            checkpoint = torch.load(self.local_checkpoint, map_location='cpu')
            self.model.load_state_dict(checkpoint)
            
            # Set device
            device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
            self.model = self.model.to(device).eval()
            
            self.use_local = True
            self.is_loaded = True
            print(f"✓ Local Depth-Anything-V2 model loaded successfully on {device}")
            return True
            
        except Exception as e:
            print(f"✗ Error loading local checkpoint: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    def estimate_depth(self, frame):
        """
        Estimate depth for a given frame.
        
        Args:
            frame: Input BGR frame from camera
            
        Returns:
            numpy array: Raw depth estimation array
        """
        if not self.is_loaded:
            return None
            
        try:
            if self.use_local:
                return self._estimate_depth_local(frame)
            else:
                return self._estimate_depth_pipeline(frame)
                
        except Exception as e:
            print(f"Error estimating depth: {e}")
            return None
            
    def _estimate_depth_pipeline(self, frame):
        """
        Estimate depth using HuggingFace pipeline.
        
        Args:
            frame: Input BGR frame from camera
            
        Returns:
            numpy array: Raw depth estimation array
        """
        if self.pipeline is None:
            return None
            
        # Convert BGR to RGB for the model
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        
        # Get depth estimation
        depth_result = self.pipeline(pil_image)
        return np.array(depth_result["depth"])
        
    def _estimate_depth_local(self, frame):
        """
        Estimate depth using local Depth-Anything-V2 model.
        
        Args:
            frame: Input BGR frame from camera
            
        Returns:
            numpy array: Raw depth estimation array
        """
        if self.model is None:
            return None
            
        try:
            # Use the model's built-in inference method
            depth = self.model.infer_image(frame)
            return depth
            
        except Exception as e:
            print(f"Error in local depth estimation: {e}")
            return None
    
    def set_colormap(self, colormap):
        """
        Set the colormap for depth visualization.
        
        Args:
            colormap: OpenCV colormap constant (e.g., cv2.COLORMAP_PLASMA)
        """
        self.current_colormap = colormap
            
    def visualize_depth(self, depth_array, colormap=None):
        """
        Convert depth array to colored visualization.
        
        Args:
            depth_array: Raw depth estimation array
            colormap: OpenCV colormap for visualization (uses current_colormap if None)
            
        Returns:
            numpy array: Colored depth visualization
        """
        if depth_array is None:
            return None
            
        try:
            # Use current colormap if none specified
            if colormap is None:
                colormap = self.current_colormap
                
            # Normalize depth to 0-255 range
            depth_normalized = cv2.normalize(
                depth_array, None, 0, 255, cv2.NORM_MINMAX
            ).astype(np.uint8)
            
            # Apply colormap for better visualization
            depth_colored = cv2.applyColorMap(depth_normalized, colormap)
            
            return depth_colored
            
        except Exception as e:
            print(f"Error visualizing depth: {e}")
            return None
            
    def process_frame(self, frame, target_size=None):
        """
        Complete depth processing pipeline for a frame.
        
        Args:
            frame: Input BGR frame from camera
            target_size: Optional tuple (width, height) to resize result
            
        Returns:
            numpy array: Colored depth visualization ready for display
        """
        # Estimate depth
        depth_array = self.estimate_depth(frame)
        if depth_array is None:
            return np.zeros_like(frame)
            
        # Visualize depth
        depth_colored = self.visualize_depth(depth_array)
        if depth_colored is None:
            return np.zeros_like(frame)
            
        # Resize if target size specified
        if target_size is not None:
            width, height = target_size
            depth_colored = cv2.resize(depth_colored, (width, height))
        else:
            # Resize to match original frame size
            height, width = frame.shape[:2]
            depth_colored = cv2.resize(depth_colored, (width, height))
            
        return depth_colored
        
    def get_depth_info(self, depth_array, point=None):
        """
        Get depth information at a specific point or overall statistics.
        
        Args:
            depth_array: Raw depth estimation array
            point: Optional tuple (x, y) for specific point depth
            
        Returns:
            dict: Depth information including min, max, mean, and point depth
        """
        if depth_array is None:
            return None
            
        info = {
            'min_depth': float(np.min(depth_array)),
            'max_depth': float(np.max(depth_array)),
            'mean_depth': float(np.mean(depth_array)),
            'shape': depth_array.shape
        }
        
        if point is not None:
            x, y = point
            if 0 <= x < depth_array.shape[1] and 0 <= y < depth_array.shape[0]:
                info['point_depth'] = float(depth_array[y, x])
            else:
                info['point_depth'] = None
                
        return info 