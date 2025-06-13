from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from gps3 import gps3
import threading
import time
from typing import Dict, Optional

app = FastAPI()

# Global variable to store the GPS data for University of Malaya, KK9, Kuala Lumpur, Malaysia
latest_gps_data = {
    "lat": 3.1209,  # University of Malaya, KK9 latitude
    "lon": 101.6559,  # University of Malaya, KK9 longitude
    "alt": 58.0,  # Approximate altitude in meters
    "speed": 0.0,  # Stationary
    "track": 0.0,  # No track/heading
    "time": "n/a"
}

# Flag to control the GPS polling thread
gps_running = True

class GPSData(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    alt: Optional[float] = None
    speed: Optional[float] = None
    track: Optional[float] = None
    time: Optional[str] = None

def poll_gps():
    """Background thread function to simulate GPS data with hardcoded coordinates for University of Malaya, KK9, Kuala Lumpur, Malaysia"""
    global latest_gps_data, gps_running
    
    # Hardcoded coordinates for University of Malaya, KK9, Kuala Lumpur, Malaysia
    um_kk9_lat = 3.1209
    um_kk9_lon = 101.6559
    
    try:
        while gps_running:
            # Update the global GPS data with hardcoded coordinates
            latest_gps_data["lat"] = um_kk9_lat
            latest_gps_data["lon"] = um_kk9_lon
            latest_gps_data["alt"] = 58.0  # Approximate altitude in meters
            latest_gps_data["speed"] = 0.0  # Stationary
            latest_gps_data["track"] = 0.0  # No track/heading
            latest_gps_data["time"] = time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime())
            
            # Sleep for a second before updating the time again
            time.sleep(1)
    except Exception as e:
        print(f"GPS simulation error: {e}")

# Start the GPS polling thread when the application starts
@app.on_event("startup")
def startup_event():
    global gps_running
    gps_running = True
    gps_thread = threading.Thread(target=poll_gps, daemon=True)
    gps_thread.start()

# Stop the GPS polling thread when the application shuts down
@app.on_event("shutdown")
def shutdown_event():
    global gps_running
    gps_running = False
    # Give the thread a moment to clean up
    time.sleep(1)

@app.get("/gps", response_model=GPSData)
def get_gps_data():
    """Get the latest GPS data"""
    return latest_gps_data

@app.get("/")
def read_root():
    """Root endpoint"""
    return {"message": "Nautilus GPS API is running"}
