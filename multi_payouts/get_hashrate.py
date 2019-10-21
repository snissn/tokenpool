import json
import websocket

def get_all_hashrates():
  ws = websocket.WebSocket()
  ws.connect("ws://mike.rs:2095/socket.io/?EIO=3&transport=websocket")

  ws.send('42["getHashrateData"]')
  for i in range(10):
    response = ws.recv()
    print(response)





def get_hashrate(address):
  ws = websocket.WebSocket()
  ws.connect("ws://mike.rs:2095/socket.io/?EIO=3&transport=websocket")

  ws.send( '42["getMinerDetails",{"address":"'+address+'"}]')
  response = ws.recv()
  response = ws.recv()
  response = ws.recv()
  response = json.loads(response[2:])
  return response[1]



def main():
  hashrate = get_hashrate("0x47Ad0177A26b31646C878cC80ba8Fc1494b58c9D")
  print(hashrate)
if __name__=="__main__":
  main()
