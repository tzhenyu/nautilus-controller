#!/usr/bin/env python3
"""
Download script for Depth Anything V2 model weights
Downloads the pre-trained model from the official repository
"""

import os
import urllib.request
import sys
from pathlib import Path

def download_file(url, destination):
    """Download a file with progress indicator"""
    def progress_hook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, downloaded * 100 / total_size)
            sys.stdout.write(f"\rDownloading: {percent:.1f}% ({downloaded}/{total_size} bytes)")
            sys.stdout.flush()
    
    try:
        print(f"Downloading {url}")
        urllib.request.urlretrieve(url, destination, progress_hook)
        print(f"\nDownload completed: {destination}")
        return True
    except Exception as e:
        print(f"\nError downloading {url}: {e}")
        return False

def main():
    """Main download function"""
    
    # Create checkpoints directory
    checkpoint_dir = Path("checkpoints")
    checkpoint_dir.mkdir(exist_ok=True)
    
    # Model configurations
    models = {
        'vitl': {
            'url': 'https://huggingface.co/depth-anything/Depth-Anything-V2-Metric-Hypersim-Large/resolve/main/depth_anything_v2_metric_hypersim_vitl.pth',
            'filename': 'depth_anything_v2_metric_hypersim_vitl.pth'
        },
        'vitb': {
            'url': 'https://huggingface.co/depth-anything/Depth-Anything-V2-Metric-Hypersim-Base/resolve/main/depth_anything_v2_metric_hypersim_vitb.pth',
            'filename': 'depth_anything_v2_metric_hypersim_vitb.pth'
        },
        'vits': {
            'url': 'https://huggingface.co/depth-anything/Depth-Anything-V2-Metric-Hypersim-Small/resolve/main/depth_anything_v2_metric_hypersim_vits.pth',
            'filename': 'depth_anything_v2_metric_hypersim_vits.pth'
        }
    }
    
    print("Depth Anything V2 Model Downloader")
    print("=" * 40)
    
    # Ask user which model to download
    print("Available models:")
    for key, model in models.items():
        print(f"  {key}: {model['filename']}")
    
    print(f"\nRecommended: vitl (most accurate, ~1.3GB)")
    choice = input("Which model would you like to download? [vitl/vitb/vits/all]: ").lower().strip()
    
    if choice == 'all':
        selected_models = models.keys()
    elif choice in models:
        selected_models = [choice]
    else:
        print("Invalid choice. Downloading vitl (recommended)")
        selected_models = ['vitl']
    
    # Download selected models
    success_count = 0
    for model_key in selected_models:
        model = models[model_key]
        destination = checkpoint_dir / model['filename']
        
        # Check if file already exists
        if destination.exists():
            print(f"\n{model['filename']} already exists. Skipping...")
            success_count += 1
            continue
        
        print(f"\nDownloading {model_key} model...")
        if download_file(model['url'], destination):
            success_count += 1
        else:
            print(f"Failed to download {model_key} model")
    
    print(f"\n" + "=" * 40)
    print(f"Downloaded {success_count}/{len(selected_models)} models successfully!")
    
    if success_count > 0:
        print(f"\nModel weights saved to: {checkpoint_dir.absolute()}")
        print(f"\nTo use the depth estimation service:")
        print(f"1. Install dependencies: pip install -r requirements.txt")
        print(f"2. Start the web server: python web-client/backend.py")
        print(f"3. Open your browser to http://localhost:8000")
        print(f"4. Start camera and click 'Start Depth' button")
        print(f"\nKeyboard shortcuts:")
        print(f"  C - Toggle camera")
        print(f"  D - Toggle depth estimation")
    
    return success_count > 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nDownload cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1) 