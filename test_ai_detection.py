#!/usr/bin/env python3
"""
Test script for AI Detection Service
Tests the YOLO model integration and basic functionality
"""

import cv2
import sys
import os

# Add web-client to path
sys.path.append('web-client')

try:
    from ai_detection_service import ai_detection_service
    print("✓ AI Detection service imported successfully")
except ImportError as e:
    print(f"✗ Failed to import AI Detection service: {e}")
    sys.exit(1)

def test_model_loading():
    """Test if the YOLO model loads correctly"""
    print("\n=== Testing Model Loading ===")
    status = ai_detection_service.get_status()
    
    if status['model_loaded']:
        print("✓ YOLO model loaded successfully")
        print(f"  Available classes: {len(status['available_classes'])}")
        print(f"  Confidence threshold: {status['confidence_threshold']}")
        return True
    else:
        print("✗ YOLO model failed to load")
        return False

def test_image_processing():
    """Test AI detection on a test image"""
    print("\n=== Testing Image Processing ===")
    
    # Check if we have a test image
    test_image_path = "images/test_image.jpg"
    if not os.path.exists(test_image_path):
        print("⚠ No test image found, creating a simple test frame")
        # Create a simple test frame
        import numpy as np
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(test_frame, "TEST FRAME", (200, 240), 
                   cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
    else:
        test_frame = cv2.imread(test_image_path)
        print(f"✓ Loaded test image: {test_image_path}")
    
    try:
        # Enable detection
        ai_detection_service.enable_detection()
        print("✓ AI detection enabled")
        
        # Process frame
        annotated_frame, detections = ai_detection_service.process_frame(test_frame)
        print(f"✓ Frame processed successfully")
        print(f"  Detections found: {len(detections)}")
        
        if detections:
            for i, detection in enumerate(detections):
                print(f"    {i+1}. {detection['class_name']}: {detection['confidence']:.2f}")
        
        # Test base64 processing
        import base64
        _, buffer = cv2.imencode('.jpg', test_frame)
        base64_frame = base64.b64encode(buffer).decode('utf-8')
        base64_frame = f"data:image/jpeg;base64,{base64_frame}"
        
        annotated_b64, detections_b64 = ai_detection_service.process_base64_frame(base64_frame)
        print("✓ Base64 frame processing works")
        
        # Save test result if possible
        try:
            cv2.imwrite("test_ai_result.jpg", annotated_frame)
            print("✓ Test result saved as test_ai_result.jpg")
        except:
            print("⚠ Could not save test result image")
        
        return True
        
    except Exception as e:
        print(f"✗ Image processing failed: {e}")
        return False

def test_confidence_threshold():
    """Test confidence threshold adjustment"""
    print("\n=== Testing Confidence Threshold ===")
    
    try:
        # Test different thresholds
        thresholds = [0.3, 0.5, 0.7]
        for threshold in thresholds:
            ai_detection_service.set_confidence_threshold(threshold)
            status = ai_detection_service.get_status()
            if abs(status['confidence_threshold'] - threshold) < 0.01:
                print(f"✓ Threshold {threshold} set correctly")
            else:
                print(f"✗ Threshold {threshold} not set correctly")
                return False
        
        return True
        
    except Exception as e:
        print(f"✗ Confidence threshold test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("AI Detection Service Test Suite")
    print("=" * 40)
    
    tests = [
        ("Model Loading", test_model_loading),
        ("Image Processing", test_image_processing),
        ("Confidence Threshold", test_confidence_threshold)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"✗ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 40)
    print("TEST SUMMARY")
    print("=" * 40)
    
    passed = 0
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! AI Detection service is ready.")
        return 0
    else:
        print("❌ Some tests failed. Check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 