from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from gps3 import gps3
import threading
import time
from typing import Dict, Optional

app = FastAPI()

# Global variable to store the latest GPS data
latest_gps_data = {
    "lat": "n/a",
    "lon": "n/a",
    "alt": "n/a",
    "speed": "n/a",
    "track": "n/a",
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
    """Background thread function to continuously poll GPS data"""
    global latest_gps_data, gps_running
    
    gps_socket = gps3.GPSDSocket()
    data_stream = gps3.DataStream()
    
    try:
        gps_socket.connect()
        gps_socket.watch()
        
        while gps_running:
            for new_data in gps_socket:
                if new_data and gps_running:
                    data_stream.unpack(new_data)
                    
                    # Update the global GPS data if we have valid latitude and longitude
                    lat = data_stream.TPV['lat']
                    lon = data_stream.TPV['lon']
                    
                    if lat != 'n/a' and lon != 'n/a':
                        latest_gps_data["lat"] = lat
                        latest_gps_data["lon"] = lon
                        latest_gps_data["alt"] = data_stream.TPV['alt']
                        latest_gps_data["speed"] = data_stream.TPV['speed']
                        latest_gps_data["track"] = data_stream.TPV['track']
                        latest_gps_data["time"] = data_stream.TPV['time']
                    
                    # Check if we should continue running
                    if not gps_running:
                        break
                    
                    time.sleep(1)
                    break
    except Exception as e:
        print(f"GPS polling error: {e}")
    finally:
        # Clean up
        gps_socket.close()

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
