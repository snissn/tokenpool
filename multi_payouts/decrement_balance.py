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
  decrement("0x0f61131764ed64c6471b8342e5172f48fabbfea8", -11.84)
