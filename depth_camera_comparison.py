#!/usr/bin/env python3
"""
Side-by-Side Camera Window for Depth Detection Testing
Left side: Normal camera feed
Right side: Depth detection visualization

Requirements: pip install transformers opencv-python torch pillow numpy
"""

import cv2
import numpy as np
import threading
import queue
import time
import os

from utils.depth_processor import DepthProcessor
from config.camera_config import CameraConfig, PerformanceConfig, DebugConfig


class DepthCameraComparison:
    """
    Main class for handling side-by-side camera comparison with depth detection.
    """
    
    def __init__(self):
        """Initialize the depth estimation pipeline and camera."""
        self.depth_processor = DepthProcessor(
            model_name=CameraConfig.DEPTH_MODEL,
            local_checkpoint=CameraConfig.LOCAL_DEPTH_CHECKPOINT
        )
        self.cap = None
        self.running = False
        self.depth_queue = queue.Queue(maxsize=CameraConfig.DEPTH_QUEUE_SIZE)
        self.depth_thread = None
        self.current_colormap_index = 0
        self.show_help = False
        self.frame_count = 0
        
        # Load depth model
        self.depth_available = self.depth_processor.load_model()
        
    def initialize_camera(self):
        """Initialize the webcam."""
        self.cap = cv2.VideoCapture(CameraConfig.CAMERA_INDEX)
        if not self.cap.isOpened():
            print("Error: Cannot open webcam")
            return False
            
        # Set camera properties for better performance
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, CameraConfig.FRAME_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CameraConfig.FRAME_HEIGHT)
        self.cap.set(cv2.CAP_PROP_FPS, CameraConfig.FPS)
        
        print("✓ Camera initialized successfully")
        return True
        
    def process_depth(self, frame):
        """
        Process depth estimation for a given frame.
        
        Args:
            frame: Input BGR frame from camera
            
        Returns:
            numpy array: Depth visualization as BGR image
        """
        if not self.depth_available:
            return np.zeros_like(frame)
            
        try:
            # Get current colormap
            current_colormap = CameraConfig.AVAILABLE_COLORMAPS[self.current_colormap_index]
            
            # Use depth processor with custom colormap
            depth_array = self.depth_processor.estimate_depth(frame)
            if depth_array is None:
                return np.zeros_like(frame)
                
            depth_colored = self.depth_processor.visualize_depth(depth_array, current_colormap)
            if depth_colored is None:
                return np.zeros_like(frame)
                
            # Resize to match original frame size
            height, width = frame.shape[:2]
            depth_resized = cv2.resize(depth_colored, (width, height))
            
            return depth_resized
            
        except Exception as e:
            print(f"Error processing depth: {e}")
            return np.zeros_like(frame)
            
    def depth_worker(self):
        """
        Worker thread for processing depth estimation.
        Runs in background to avoid blocking the main camera feed.
        """
        while self.running:
            try:
                # Get the latest frame for depth processing
                if hasattr(self, 'latest_frame') and self.latest_frame is not None:
                    depth_frame = self.process_depth(self.latest_frame)
                    
                    # Put result in queue (non-blocking)
                    try:
                        self.depth_queue.put(depth_frame, block=False)
                    except queue.Full:
                        # Remove old depth frame if queue is full
                        try:
                            self.depth_queue.get(block=False)
                            self.depth_queue.put(depth_frame, block=False)
                        except queue.Empty:
                            pass
                            
                time.sleep(CameraConfig.DEPTH_PROCESS_INTERVAL)  # Limit depth processing rate
                
            except Exception as e:
                print(f"Error in depth worker: {e}")
                time.sleep(1)
                
    def create_side_by_side_display(self, normal_frame, depth_frame):
        """
        Create side-by-side display with normal and depth frames.
        
        Args:
            normal_frame: Original camera frame
            depth_frame: Depth visualization frame
            
        Returns:
            numpy array: Combined side-by-side frame
        """
        height, width = normal_frame.shape[:2]
        
        # Create combined frame
        combined_frame = np.zeros((height, width * 2, 3), dtype=np.uint8)
        
        # Place normal frame on left
        combined_frame[:, :width] = normal_frame
        
        # Place depth frame on right
        combined_frame[:, width:] = depth_frame
        
        # Add labels
        font = CameraConfig.FONT
        font_scale = CameraConfig.FONT_SCALE
        color = CameraConfig.FONT_COLOR
        thickness = CameraConfig.FONT_THICKNESS
        
        # Label for normal camera
        cv2.putText(
            combined_frame, CameraConfig.NORMAL_CAMERA_LABEL, (10, 30), 
            font, font_scale, color, thickness
        )
        
        # Label for depth detection with current colormap
        colormap_name = CameraConfig.COLORMAP_NAMES[self.current_colormap_index]
        depth_label = f"{CameraConfig.DEPTH_DETECTION_LABEL} ({colormap_name})"
        cv2.putText(
            combined_frame, depth_label, (width + 10, 30), 
            font, font_scale, color, thickness
        )
        
        # Add separator line
        cv2.line(
            combined_frame, (width, 0), (width, height), 
            CameraConfig.SEPARATOR_COLOR, CameraConfig.SEPARATOR_THICKNESS
        )
        
        return combined_frame
        
    def run(self):
        """Main execution loop for the camera comparison."""
        if not self.initialize_camera():
            return
            
        if not self.depth_available:
            print("Warning: Depth estimation not available, showing normal camera only")
            
        self.running = True
        
        # Start depth processing thread
        if self.depth_available and PerformanceConfig.ENABLE_THREADING:
            self.depth_thread = threading.Thread(target=self.depth_worker)
            self.depth_thread.daemon = True
            self.depth_thread.start()
            
        print("\n" + "="*60)
        print("DEPTH CAMERA COMPARISON STARTED")
        print("="*60)
        print(CameraConfig.CONTROLS_HELP)
        print("="*60)
        
        # Initialize depth frame
        current_depth_frame = None
        
        try:
            while True:
                # Read frame from camera
                ret, frame = self.cap.read()
                if not ret:
                    print("Error: Cannot read frame from camera")
                    break
                    
                self.frame_count += 1
                
                # Store latest frame for depth processing
                self.latest_frame = frame.copy()
                
                # Get latest depth frame if available
                try:
                    while not self.depth_queue.empty():
                        current_depth_frame = self.depth_queue.get(block=False)
                except queue.Empty:
                    pass
                    
                # Use previous depth frame or create placeholder
                if current_depth_frame is None:
                    height, width = frame.shape[:2]
                    current_depth_frame = np.zeros((height, width, 3), dtype=np.uint8)
                    cv2.putText(
                        current_depth_frame, CameraConfig.PROCESSING_LABEL, 
                        (width//4, height//2), CameraConfig.FONT, 
                        1, CameraConfig.FONT_COLOR, 2
                    )
                
                # Create side-by-side display
                display_frame = self.create_side_by_side_display(frame, current_depth_frame)
                
                # Add help overlay if enabled
                if self.show_help:
                    self.add_help_overlay(display_frame)
                
                # Add debug information
                if DebugConfig.ENABLE_FPS_COUNTER:
                    cv2.putText(
                        display_frame, f"Frame: {self.frame_count}", 
                        (10, display_frame.shape[0] - 20), 
                        CameraConfig.FONT, 0.5, (0, 255, 0), 1
                    )
                
                # Display the combined frame
                cv2.imshow(CameraConfig.WINDOW_TITLE, display_frame)
                
                # Handle key presses
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('s'):
                    # Save screenshot
                    timestamp = int(time.time())
                    filename = f"depth_comparison_{timestamp}.jpg"
                    cv2.imwrite(filename, display_frame)
                    print(f"Screenshot saved as {filename}")
                elif key == ord('r'):
                    # Reset depth processing
                    print("Resetting depth processing...")
                    current_depth_frame = None
                    self._clear_depth_queue()
                elif key == ord('c'):
                    # Change colormap
                    self.current_colormap_index = (self.current_colormap_index + 1) % len(CameraConfig.AVAILABLE_COLORMAPS)
                    colormap_name = CameraConfig.COLORMAP_NAMES[self.current_colormap_index]
                    print(f"Changed colormap to: {colormap_name}")
                    current_depth_frame = None  # Force refresh
                elif key == ord('h'):
                    # Toggle help display
                    self.show_help = not self.show_help
                    print(f"Help display: {'ON' if self.show_help else 'OFF'}")
                            
        except KeyboardInterrupt:
            print("\nInterrupted by user")
            
        finally:
            self.cleanup()
    
    def _clear_depth_queue(self):
        """Clear the depth processing queue."""
        while not self.depth_queue.empty():
            try:
                self.depth_queue.get(block=False)
            except queue.Empty:
                break
                
    def add_help_overlay(self, frame):
        """
        Add help text overlay to the frame.
        
        Args:
            frame: Frame to add overlay to
        """
        # Create semi-transparent overlay
        overlay = frame.copy()
        height, width = frame.shape[:2]
        
        # Background rectangle for help text
        cv2.rectangle(overlay, (10, 50), (width - 10, height - 50), (0, 0, 0), -1)
        
        # Blend with original frame
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        # Add help text
        help_lines = CameraConfig.CONTROLS_HELP.strip().split('\n')
        y_offset = 80
        for line in help_lines:
            if line.strip():
                cv2.putText(
                    frame, line.strip(), (20, y_offset),
                    CameraConfig.FONT, 0.6, CameraConfig.FONT_COLOR, 1
                )
                y_offset += 25
            
    def cleanup(self):
        """Clean up resources."""
        print("\nCleaning up...")
        self.running = False
        
        if self.depth_thread and self.depth_thread.is_alive():
            self.depth_thread.join(timeout=PerformanceConfig.THREAD_TIMEOUT)
            
        if self.cap:
            self.cap.release()
            
        cv2.destroyAllWindows()
        print("✓ Cleanup completed")


def main():
    """Main entry point."""
    print("Depth Camera Comparison Tool")
    print("This tool shows normal camera feed alongside depth detection")
    print("Loading components...")
    
    try:
        app = DepthCameraComparison()
        app.run()
    except Exception as e:
        print(f"Error running application: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main() 