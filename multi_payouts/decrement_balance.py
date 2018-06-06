import json
import redis

r = redis.Redis()
def decrement(pub, amount):
  satoshis = amount*1E8
  data = r.hget("miner_data",pub)
  print('before',data)
  data = json.loads(data.decode())
  data['tokenBalance'] -= satoshis
  r.hset("miner_data",pub,json.dumps(data).encode())
  print('after',data)

  

if __name__=="__main__":
  decrement("0x1E33cEF6A45b10f091c7256CAbF2A9bAD1864b08", -16.4)
