import websockets 
import websocket
ws = websocket.WebSocket()
ws.connect("ws://mike.rs:2095/socket.io/?EIO=3&transport=websocket")

ws.send('42["getHashrateData"]')
for i in range(10):
  response = ws.recv()
  print(response)

