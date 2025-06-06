from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
import asyncio
import json
from datetime import datetime
import random
from gpiozero import AngularServo
from time import sleep
# Import the servo control modules
from gpiozero import AngularServo
from time import sleep

app = FastAPI()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize the servo on GPIO pin 14
servo = AngularServo(14, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

# Initialize the servo on GPIO pin 14
servo = AngularServo(14, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

# Global state for robot control
robot_state = {
    "x": 0.0,
    "y": 0.0,
    "heading": 0.0,
    "motor_speed": 50,
    "servo_angle": 0,
    "camera_enabled": False,
    "is_moving": False,
    "current_direction": "stopped"
}

# Function to set the servo angle
def set_servo_angle(angle):
    servo.angle = angle
    sleep(0.05)

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/move")
async def move_robot(request: Request):
    data = await request.json()
    direction = data.get("direction")
    speed = robot_state["motor_speed"]
    
    robot_state["is_moving"] = True
    robot_state["current_direction"] = direction
    
    # Mock movement - update coordinates based on direction
    step_size = speed / 100 * 0.5  # Scale movement
    
    if direction == "forward":
        robot_state["y"] += step_size
    elif direction == "backward":
        robot_state["y"] -= step_size
    elif direction == "left":
        robot_state["x"] -= step_size
        robot_state["heading"] = (robot_state["heading"] - 5) % 360
    elif direction == "right":
        robot_state["x"] += step_size
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
    robot_state["temperature"] = round(random.uniform(20, 35), 1)
    
    return JSONResponse(robot_state)

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    finally:
        # Reset servo position when exiting
        servo.angle = 0
        print("Servo reset to 0 degrees")