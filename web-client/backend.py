from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
import asyncio
import json
from datetime import datetime
import random
import platform
from time import sleep
from gps3 import gps3
import threading

SERVO_MOTOR_GPIO = 17

# Mock servo class for development on non-Raspberry Pi systems
class MockServo:
    def __init__(self, pin, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000):
        self.pin = pin
        self.min_angle = min_angle
        self.max_angle = max_angle
        self._angle = 0
        print(f"Mock servo initialized on pin {pin}")
    
    @property
    def angle(self):
        return self._angle
    
    @angle.setter
    def angle(self, value):
        self._angle = max(self.min_angle, min(self.max_angle, value))
        print(f"Mock servo angle set to {self._angle} degrees")

# Mock GPS module for development
class MockGPS:
    def __init__(self):
        self.latitude = 40.7128
        self.longitude = -74.0060
        self.altitude = 10.0
        print("Mock GPS initialized")

app = FastAPI()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="."), name="static")
app.mount("/images", StaticFiles(directory="../images"), name="images")
templates = Jinja2Templates(directory="static")

try:
    from gpiozero import AngularServo
    servo = AngularServo(SERVO_MOTOR_GPIO, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)
except (ImportError, RuntimeError):
    # Fallback to mock if not on Raspberry Pi or gpiozero is unavailable
    servo = MockServo(SERVO_MOTOR_GPIO, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

# Global state for robot control
robot_state = {
    "posX": 0.0,
    "posY": 0.0,
    "heading": 0.0,
    "motor_speed": 50,
    "servo_angle": 0,
    "camera_enabled": False,
    "is_moving": False,
    "current_direction": "stopped",
    "gps_status": "initializing"
}

# GPS data collection variables
gps_thread = None
gps_running = False

# Function to set the servo angle
def set_servo_angle(angle):
    servo.angle = angle
    sleep(0.05)

# Function to collect GPS data in background
def collect_gps_data():
    global gps_socket, data_stream, gps_running
    
    print("[DEBUG] GPS thread: Starting GPS data collection")
    
    try:
        # Initialize connection to GPS
        print("[DEBUG] GPS thread: Creating socket connection")
        gps_socket = gps3.GPSDSocket()
        data_stream = gps3.DataStream()
        
        # Check if GPSD is running
        print("[DEBUG] GPS thread: Connecting to GPSD service")
        try:
            gps_socket.connect()
            print("[DEBUG] GPS thread: Connection successful")
        except Exception as e:
            print(f"[ERROR] GPS thread: Failed to connect to GPSD: {str(e)}")
            robot_state["gps_status"] = f"connection_failed: {str(e)}"
            return
            
        gps_socket.watch()
        robot_state["gps_status"] = "connected"
        print("[DEBUG] GPS thread: Watch mode set, waiting for data...")
        
        # Main data collection loop
        counter = 0
        while gps_running:            
            # Get a single data packet with timeout
            try:
                # Use the socket with a timeout
                next_data = next(gps_socket)
                if next_data:
                    data_stream.unpack(next_data)
                    
                    
                    lat = data_stream.TPV.get('lat', 'n/a')
                    lon = data_stream.TPV.get('lon', 'n/a')
                    
                    print(f"[DEBUG] GPS thread: Position data - lat: {lat}, lon: {lon}")
                    
                    if lat != 'n/a' and lon != 'n/a':
                        robot_state["posX"] = float(lat)
                        robot_state["posY"] = float(lon)
                        robot_state["gps_status"] = "active"
                    else:
                        robot_state["gps_status"] = "no_fix"
                else:
                    print("[DEBUG] GPS thread: No data received in this iteration")
            except StopIteration:
                print("[DEBUG] GPS thread: End of data stream")
                break
            except Exception as e:
                print(f"[ERROR] GPS thread: Error processing GPS data: {str(e)}")
            
            # Sleep between polls
            sleep(2)
            
    except Exception as e:
        print(f"[ERROR] GPS thread: Critical error: {str(e)}")
        robot_state["gps_status"] = f"error: {str(e)}"
    finally:
        print("[DEBUG] GPS thread: Cleaning up GPS resources")
        if gps_socket:
            try:
                gps_socket.close()
                print("[DEBUG] GPS thread: GPS socket closed")
            except Exception as e:
                print(f"[ERROR] GPS thread: Error closing socket: {str(e)}")
        robot_state["gps_status"] = "disconnected"
        print("[DEBUG] GPS thread: GPS collection terminated")

# Start GPS data collection thread
def start_gps():
    global gps_thread, gps_running
    print("[DEBUG] Attempting to start GPS thread...")
    if gps_thread is None or not gps_thread.is_alive():
        gps_running = True
        gps_thread = threading.Thread(target=collect_gps_data)
        gps_thread.daemon = True
        gps_thread.start()
        print(f"[DEBUG] GPS thread started successfully. Thread ID: {gps_thread.ident}")
    else:
        print("[DEBUG] GPS thread already running. Skipping initialization.")

# Stop GPS data collection
def stop_gps():
    global gps_running
    gps_running = False
    if gps_thread is not None:
        gps_thread.join(timeout=2.0)
    print("GPS data collection stopped")

# Start GPS on application startup
@app.on_event("startup")
async def startup_event():
    start_gps()

# Stop GPS on application shutdown
@app.on_event("shutdown")
async def shutdown_event():
    stop_gps()

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/move")
async def move_robot(request: Request):
    data = await request.json()
    direction = data.get("direction")
    
    robot_state["is_moving"] = True
    robot_state["current_direction"] = direction
    
    # Note: No need to modify GPS coordinates as they come from the GPS module
    # Just update the heading based on direction
    if direction == "left":
        robot_state["heading"] = (robot_state["heading"] - 5) % 360
    elif direction == "right":
        robot_state["heading"] = (robot_state["heading"] + 5) % 360
    
    return JSONResponse({"status": "success", "direction": direction, "state": robot_state})

@app.post("/api/stop")
async def stop_robot():
    robot_state["is_moving"] = False
    robot_state["current_direction"] = "stopped"
    return JSONResponse({"status": "success", "state": robot_state})

@app.post("/api/servo/toggle")
async def toggle_servo():
    # Toggle between 0 and 180 degrees
    new_angle = 180 if robot_state["servo_angle"] == 0 else 0
    robot_state["servo_angle"] = new_angle
    
    # Actually control the physical servo
    set_servo_angle(new_angle)
    
    return JSONResponse({
        "status": "success", 
        "servo_angle": robot_state["servo_angle"],
        "state": robot_state
    })

@app.post("/api/servo/set")
async def set_servo(request: Request):
    data = await request.json()
    angle = max(0, min(180, int(data.get("angle", 0))))
    robot_state["servo_angle"] = angle
    
    # Actually control the physical servo
    set_servo_angle(angle)
    
    return JSONResponse({
        "status": "success", 
        "servo_angle": robot_state["servo_angle"],
        "state": robot_state
    })

@app.post("/api/camera/toggle")
async def toggle_camera():
    robot_state["camera_enabled"] = not robot_state["camera_enabled"]
    return JSONResponse({
        "status": "success", 
        "camera_enabled": robot_state["camera_enabled"],
        "state": robot_state
    })

@app.post("/api/speed")
async def set_speed(request: Request):
    data = await request.json()
    speed = max(0, min(100, int(data.get("speed", 50))))
    robot_state["motor_speed"] = speed
    return JSONResponse({"status": "success", "speed": speed, "state": robot_state})

@app.get("/api/status")
async def get_status():
    # Add some random sensor data for realism
    robot_state["timestamp"] = datetime.now().isoformat()
    robot_state["battery"] = random.randint(70, 100)
    robot_state["temperature"] = round(random.uniform(20, 100), 1)
    
    return JSONResponse(robot_state)

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        # Reset servo position when exiting
        servo.angle = 0
        print("Servo reset to 0 degrees")