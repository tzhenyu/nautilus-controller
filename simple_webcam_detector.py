#!/usr/bin/env python3
"""
Simple YOLOv5 Webcam Detector
This file can be copied to any project for quick webcam object detection.
Requirements: pip install ultralytics opencv-python
"""

import cv2
from ultralytics import YOLO

def main():
    # Load YOLOv5 model
    model = YOLO('yolov5s.pt')
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Cannot open webcam")
        return
    
    print("Webcam detection started. Press 'q' to quit.")
    
    while True:
        # Read frame from webcam
        ret, frame = cap.read()
        if not ret:
            print("Error: Cannot read frame")
            break
        
        # Run YOLOv5 detection
        results = model(frame)
        
        # Draw results on frame
        annotated_frame = results[0].plot()
        
        # Display frame
        cv2.imshow('YOLOv5 Webcam Detection', annotated_frame)
        
        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Clean up
    cap.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")

if __name__ == "__main__":
    main() 