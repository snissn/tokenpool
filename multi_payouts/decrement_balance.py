import json
import redis

r = redis.Redis(host='10.142.0.4')
def decrement(pub, amount):
  satoshis = amount*1E8
  data = r.hget("miner_data",pub)
  print('before',data)
  data = json.loads(data.decode())
  data['tokenBalance'] -= satoshis
  r.hset("miner_data",pub,json.dumps(data).encode())
  print('after',data)

  

if __name__=="__main__":
  decrement("0x53Eb47Ab9CE1e70D33BC8EDa730A187a262ac734", 10)
