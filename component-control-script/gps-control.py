from gps3 import gps3
from time import sleep

gps_socket = gps3.GPSDSocket()
data_stream = gps3.DataStream()
gps_socket.connect()
gps_socket.watch()

for new_data in gps_socket:
    if new_data:
        data_stream.unpack(new_data)
        lat = data_stream.TPV['lat']
        lon = data_stream.TPV['lon']
        if lat != 'n/a' and lon != 'n/a':
            print(f"Latitude: {lat}, Longitude: {lon}")
            sleep(1)