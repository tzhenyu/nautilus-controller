from gpiozero import AngularServo
from time import sleep

# Initialize the servo on GPIO pin 14
# min_pulse_width and max_pulse_width may need to be adjusted for your servo
servo = AngularServo(14, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

# Function to set the servo angle
def set_angle(angle):
    servo.angle = angle
    sleep(0.05)

# Variable to track current position
current_position = 0  # Start at 0 degrees

# Main program loop
try:
    print("Press Enter to toggle the servo between 120 and 0 degrees")
    print("Type 'exit' to quit")
    
    while True:
        user_input = input()
        if user_input.lower() == 'exit':
            break
        
        # Toggle between 120 and 0 degrees
        if current_position == 0:
            current_position = 90
        else:
            current_position = 0
            
        set_angle(current_position)
        print(f"Servo turned to {current_position} degrees")
        print("Press Enter to toggle position, or type 'exit' to quit")
            
except KeyboardInterrupt:
    print("\nProgram stopped by user")
finally:
    # Reset servo position when exiting
    servo.angle = 0
    print("Servo reset to 0 degrees")