"""
AI Detection Service for Nautilus Controller
Provides real-time object detection using YOLO models for the web interface.
"""

import cv2
import numpy as np
import base64
import io
import threading
import time
from typing import Dict, List, Optional, Tuple
from ultralytics import YOLO
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIDetectionService:
    """Service for AI-powered object detection using YOLO models."""
    
    def __init__(self, model_path: str = '../yolov5su.pt'):
        """
        Initialize the AI detection service.
        
        Args:
            model_path: Path to the YOLO model file
        """
        self.model_path = model_path
        self.model = None
        self.is_enabled = False
        self.is_processing = False
        self.confidence_threshold = 0.5
        self.detection_classes = []
        self.last_detection_time = 0
        self.detection_fps = 0
        self.load_model()
    
    def load_model(self) -> bool:
        """
        Load the YOLO model.
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        try:
            logger.info(f"Loading YOLO model from {self.model_path}")
            self.model = YOLO(self.model_path)
            logger.info("YOLO model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            return False
    
    def set_confidence_threshold(self, threshold: float) -> None:
        """
        Set the confidence threshold for detections.
        
        Args:
            threshold: Confidence threshold (0.0 to 1.0)
        """
        self.confidence_threshold = max(0.0, min(1.0, threshold))
        logger.info(f"Confidence threshold set to {self.confidence_threshold}")
    
    def enable_detection(self) -> bool:
        """
        Enable AI detection.
        
        Returns:
            bool: True if enabled successfully, False otherwise
        """
        if not self.model:
            logger.error("Cannot enable detection: Model not loaded")
            return False
        
        self.is_enabled = True
        logger.info("AI detection enabled")
        return True
    
    def disable_detection(self) -> None:
        """Disable AI detection."""
        self.is_enabled = False
        self.is_processing = False
        logger.info("AI detection disabled")
    
    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Dict]]:
        """
        Process a single frame for object detection.
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            Tuple of (annotated_frame, detections_list)
        """
        if not self.is_enabled or not self.model:
            return frame, []
        
        try:
            self.is_processing = True
            start_time = time.time()
            
            # Run inference
            results = self.model(frame, conf=self.confidence_threshold)
            
            # Process results
            detections = []
            annotated_frame = frame.copy()
            
            if len(results) > 0:
                result = results[0]
                
                # Extract detection information
                if result.boxes is not None:
                    boxes = result.boxes.xyxy.cpu().numpy()
                    confidences = result.boxes.conf.cpu().numpy()
                    class_ids = result.boxes.cls.cpu().numpy().astype(int)
                    
                    # Draw detections and collect information
                    for i, (box, conf, class_id) in enumerate(zip(boxes, confidences, class_ids)):
                        x1, y1, x2, y2 = box.astype(int)
                        
                        # Get class name
                        class_name = self.model.names[class_id] if class_id < len(self.model.names) else f"Class_{class_id}"
                        
                        # Add to detections list
                        detection = {
                            'class_id': int(class_id),
                            'class_name': class_name,
                            'confidence': float(conf),
                            'bbox': [int(x1), int(y1), int(x2), int(y2)],
                            'center': [int((x1 + x2) / 2), int((y1 + y2) / 2)]
                        }
                        detections.append(detection)
                        
                        # Draw bounding box
                        color = self._get_class_color(class_id)
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                        
                        # Draw label
                        label = f"{class_name}: {conf:.2f}"
                        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                        
                        # Draw label background
                        cv2.rectangle(annotated_frame, 
                                    (x1, y1 - label_size[1] - 10), 
                                    (x1 + label_size[0], y1), 
                                    color, -1)
                        
                        # Draw label text
                        cv2.putText(annotated_frame, label, 
                                  (x1, y1 - 5), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.6, 
                                  (255, 255, 255), 2)
            
            # Update FPS calculation
            processing_time = time.time() - start_time
            self.detection_fps = 1.0 / processing_time if processing_time > 0 else 0
            self.last_detection_time = start_time
            
            # Add FPS overlay
            fps_text = f"AI FPS: {self.detection_fps:.1f} | Objects: {len(detections)}"
            cv2.putText(annotated_frame, fps_text, (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            self.is_processing = False
            return annotated_frame, detections
            
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            self.is_processing = False
            return frame, []
    
    def process_base64_frame(self, base64_data: str) -> Tuple[str, List[Dict]]:
        """
        Process a base64-encoded frame for object detection.
        
        Args:
            base64_data: Base64-encoded image data
            
        Returns:
            Tuple of (base64_annotated_frame, detections_list)
        """
        try:
            # Decode base64 to numpy array
            frame = self._base64_to_frame(base64_data)
            
            # Process frame
            annotated_frame, detections = self.process_frame(frame)
            
            # Encode result back to base64
            annotated_base64 = self._frame_to_base64(annotated_frame)
            
            return annotated_base64, detections
            
        except Exception as e:
            logger.error(f"Error processing base64 frame: {e}")
            return base64_data, []
    
    def _base64_to_frame(self, base64_data: str) -> np.ndarray:
        """Convert base64 string to numpy array frame."""
        # Remove data URL prefix if present
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(base64_data)
        
        # Convert to numpy array
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        return frame
    
    def _frame_to_base64(self, frame: np.ndarray) -> str:
        """Convert numpy array frame to base64 string."""
        # Encode frame to JPEG
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        # Convert to base64
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/jpeg;base64,{image_base64}"
    
    def _get_class_color(self, class_id: int) -> Tuple[int, int, int]:
        """Get a consistent color for a class ID."""
        # Generate consistent colors based on class ID
        np.random.seed(class_id)
        color = tuple(np.random.randint(0, 255, 3).tolist())
        return color
    
    def get_status(self) -> Dict:
        """
        Get the current status of the AI detection service.
        
        Returns:
            Dict containing service status information
        """
        return {
            'enabled': self.is_enabled,
            'processing': self.is_processing,
            'model_loaded': self.model is not None,
            'confidence_threshold': self.confidence_threshold,
            'detection_fps': self.detection_fps,
            'last_detection_time': self.last_detection_time,
            'available_classes': list(self.model.names.values()) if self.model else []
        }
    
    def get_detection_summary(self, detections: List[Dict]) -> Dict:
        """
        Generate a summary of detections.
        
        Args:
            detections: List of detection dictionaries
            
        Returns:
            Dict containing detection summary
        """
        if not detections:
            return {'total_objects': 0, 'classes': {}}
        
        class_counts = {}
        for detection in detections:
            class_name = detection['class_name']
            class_counts[class_name] = class_counts.get(class_name, 0) + 1
        
        return {
            'total_objects': len(detections),
            'classes': class_counts,
            'highest_confidence': max(d['confidence'] for d in detections),
            'detection_time': time.time()
        }

# Global instance for the web service
ai_detection_service = AIDetectionService() 