"""
Depth Estimation Service using Depth Anything V2
Provides real-time depth estimation API endpoints for the camera feed
"""

import cv2
import numpy as np
import torch
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from PIL import Image
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
import os

# Import Depth Anything V2
from depth_anything_v2.dpt import DepthAnythingV2

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DepthEstimationService:
    def __init__(self, encoder='vitl', input_size=518):
        """
        Initialize the Depth Estimation Service
        
        Args:
            encoder: Model size ('vits', 'vitb', 'vitl', 'vitg')
            input_size: Input image size for processing
        """
        self.encoder = encoder
        self.input_size = input_size
        self.model = None
        self.device = None
        self.executor = ThreadPoolExecutor(max_workers=2)
        self.is_model_loaded = False
        
        # Color maps for depth visualization
        self.cmap = matplotlib.colormaps.get_cmap('Spectral')
        self.grayscale_mode = False
        
        # Model configurations
        self.model_configs = {
            'vits': {'encoder': 'vits', 'features': 64, 'out_channels': [48, 96, 192, 384]},
            'vitb': {'encoder': 'vitb', 'features': 128, 'out_channels': [96, 192, 384, 768]},
            'vitl': {'encoder': 'vitl', 'features': 256, 'out_channels': [256, 512, 1024, 1024]},
            'vitg': {'encoder': 'vitg', 'features': 384, 'out_channels': [1536, 1536, 1536, 1536]}
        }
        
        self.load_model()
    
    def load_model(self):
        """Load the Depth Anything V2 model"""
        try:
            logger.info(f"Loading Depth Anything V2 model ({self.encoder})...")
            
            # Determine device
            self.device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
            logger.info(f"Using device: {self.device}")
            
            # Initialize model
            config = self.model_configs[self.encoder].copy()
            # Note: max_depth is not a constructor parameter for DepthAnythingV2
            # It's used during inference instead
            
            self.model = DepthAnythingV2(**config)
            
            # Try to load weights
            checkpoint_paths = [
                f'checkpoints/depth_anything_v2_metric_hypersim_{self.encoder}.pth',
                f'checkpoints/depth_anything_v2_{self.encoder}.pth',
                f'metric_depth/checkpoints/depth_anything_v2_metric_hypersim_{self.encoder}.pth'
            ]
            
            checkpoint_loaded = False
            for checkpoint_path in checkpoint_paths:
                if os.path.exists(checkpoint_path):
                    logger.info(f"Loading checkpoint from {checkpoint_path}")
                    self.model.load_state_dict(torch.load(checkpoint_path, map_location='cpu'))
                    checkpoint_loaded = True
                    break
            
            if not checkpoint_loaded:
                logger.warning("No checkpoint found. Using randomly initialized weights.")
                logger.warning("Please download the appropriate checkpoint from the official repository.")
            
            self.model = self.model.to(self.device).eval()
            self.is_model_loaded = True
            
            logger.info("Depth Anything V2 model loaded successfully!")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.is_model_loaded = False
            raise
    
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """Preprocess image from bytes to numpy array"""
        try:
            # Convert bytes to PIL Image
            image = Image.open(BytesIO(image_bytes))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array (OpenCV format - BGR)
            image_np = np.array(image)[:, :, ::-1]  # RGB to BGR
            
            return image_np
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise
    
    def estimate_depth_sync(self, image_np: np.ndarray) -> np.ndarray:
        """Synchronous depth estimation"""
        if not self.is_model_loaded:
            raise RuntimeError("Model is not loaded")
        
        try:
            with torch.no_grad():
                # Estimate depth
                depth = self.model.infer_image(image_np, self.input_size)
                return depth
                
        except Exception as e:
            logger.error(f"Error during depth estimation: {e}")
            raise
    
    async def estimate_depth(self, image_bytes: bytes) -> np.ndarray:
        """Asynchronous depth estimation"""
        loop = asyncio.get_event_loop()
        
        # Preprocess image
        image_np = await loop.run_in_executor(self.executor, self.preprocess_image, image_bytes)
        
        # Estimate depth
        depth = await loop.run_in_executor(self.executor, self.estimate_depth_sync, image_np)
        
        return depth
    
    def create_depth_visualization(self, depth: np.ndarray, colorize: bool = True) -> bytes:
        """Create depth visualization image"""
        try:
            # Normalize depth to 0-255
            depth_min = depth.min()
            depth_max = depth.max()
            
            # Handle case where all values are the same (avoid division by zero)
            if depth_max - depth_min == 0:
                depth_normalized = np.zeros_like(depth, dtype=np.uint8)
            else:
                depth_normalized = (depth - depth_min) / (depth_max - depth_min) * 255.0
                depth_normalized = depth_normalized.astype(np.uint8)
            
            if colorize and not self.grayscale_mode:
                # Apply colormap
                depth_colored = (self.cmap(depth_normalized)[:, :, :3] * 255)[:, :, ::-1].astype(np.uint8)
            else:
                # Grayscale
                depth_colored = np.repeat(depth_normalized[..., np.newaxis], 3, axis=-1)
            
            # Convert to bytes
            _, buffer = cv2.imencode('.png', depth_colored)
            return buffer.tobytes()
            
        except Exception as e:
            logger.error(f"Error creating depth visualization: {e}")
            raise
    
    def create_side_by_side_visualization(self, original_image: np.ndarray, depth: np.ndarray) -> bytes:
        """Create side-by-side visualization of original and depth"""
        try:
            # Create depth visualization
            depth_min = depth.min()
            depth_max = depth.max()
            
            # Handle case where all values are the same (avoid division by zero)
            if depth_max - depth_min == 0:
                depth_normalized = np.zeros_like(depth, dtype=np.uint8)
            else:
                depth_normalized = (depth - depth_min) / (depth_max - depth_min) * 255.0
                depth_normalized = depth_normalized.astype(np.uint8)
            
            if not self.grayscale_mode:
                depth_colored = (self.cmap(depth_normalized)[:, :, :3] * 255)[:, :, ::-1].astype(np.uint8)
            else:
                depth_colored = np.repeat(depth_normalized[..., np.newaxis], 3, axis=-1)
            
            # Resize to match original image
            h, w = original_image.shape[:2]
            depth_colored = cv2.resize(depth_colored, (w, h))
            
            # Create separator
            separator = np.ones((h, 10, 3), dtype=np.uint8) * 255
            
            # Combine horizontally
            combined = cv2.hconcat([original_image, separator, depth_colored])
            
            # Convert to bytes
            _, buffer = cv2.imencode('.png', combined)
            return buffer.tobytes()
            
        except Exception as e:
            logger.error(f"Error creating side-by-side visualization: {e}")
            raise
    
    async def process_image_for_api(self, image_bytes: bytes, visualization_type: str = "depth_only") -> bytes:
        """Process image and return visualization"""
        try:
            # Preprocess original image
            original_image = self.preprocess_image(image_bytes)
            
            # Estimate depth
            depth = await self.estimate_depth(image_bytes)
            
            # Create visualization based on type
            if visualization_type == "side_by_side":
                result_bytes = self.create_side_by_side_visualization(original_image, depth)
            else:  # depth_only
                result_bytes = self.create_depth_visualization(depth, colorize=True)
            
            return result_bytes
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            raise

    def get_model_info(self):
        """Get model information"""
        return {
            "encoder": self.encoder,
            "input_size": self.input_size,
            "device": self.device,
            "is_loaded": self.is_model_loaded,
            "available": self.is_model_loaded
        }
    
    def set_grayscale_mode(self, grayscale: bool):
        """Set grayscale mode for depth visualization"""
        self.grayscale_mode = grayscale

# Global service instance
depth_service = None

def get_depth_service() -> DepthEstimationService:
    """Get or create the global depth service instance"""
    global depth_service
    if depth_service is None:
        depth_service = DepthEstimationService()
    return depth_service

# FastAPI endpoints for integration
def create_depth_api_routes(app: FastAPI):
    """Create depth estimation API routes"""
    
    @app.get("/api/depth/status")
    async def get_depth_status():
        """Get depth service status"""
        try:
            service = get_depth_service()
            return service.get_model_info()
        except Exception as e:
            return {"available": False, "error": str(e)}
    
    @app.post("/api/depth/process")
    async def process_depth_image(
        image: UploadFile = File(...),
        visualization: str = "depth_only"  # "depth_only" or "side_by_side"
    ):
        """Process image for depth estimation"""
        try:
            if not image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="File must be an image")
            
            # Read image bytes
            image_bytes = await image.read()
            
            # Process image
            service = get_depth_service()
            result_bytes = await service.process_image_for_api(image_bytes, visualization)
            
            # Return as streaming response
            return StreamingResponse(
                BytesIO(result_bytes),
                media_type="image/png",
                headers={"Cache-Control": "no-cache"}
            )
            
        except Exception as e:
            logger.error(f"Error in depth processing endpoint: {e}")
            raise HTTPException(status_code=500, detail=f"Depth processing failed: {str(e)}")
    
    @app.post("/api/depth/settings")
    async def update_depth_settings(grayscale: Optional[bool] = None):
        """Update depth visualization settings"""
        try:
            service = get_depth_service()
            
            if grayscale is not None:
                service.set_grayscale_mode(grayscale)
            
            return {"status": "success", "settings": {"grayscale": service.grayscale_mode}}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

if __name__ == "__main__":
    # Test the service
    import uvicorn
    
    app = FastAPI(title="Depth Estimation Service")
    create_depth_api_routes(app)
    
    uvicorn.run(app, host="0.0.0.0", port=8001) 