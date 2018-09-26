import redis
import datetime
import json

def increment(pub, satoshis):
  data = r.hget("miner_data",pub)
  print('before',data,pub)
  data = json.loads(data.decode())
  data['tokenBalance'] += satoshis
  data['tokensAwarded'] -= satoshis
  r.hset("miner_data",pub,json.dumps(data).encode())
  print('after',data)





def delete(miner, miner_hash):
  fp = open("delete_log.json",'a')
  js= json.dumps([ miner_hash, miner])
  fp.write(js+"\n")
  print js
  fp.close()
  r.hdel("miner_data",miner_hash)


def inspect(miner_hash):
  miner = r.hget("miner_data", miner_hash)
  miner = json.loads(miner)
  delta = datetime.datetime.now() - datetime.datetime.fromtimestamp(miner['lastSubmittedSolutionTime'])
  if delta.days > 40:
    delete(miner, miner_hash)


r = redis.Redis(host='10.142.0.4')
miners = r.hgetall("miner_data")
for miner_hash in miners:
  try:
    inspect(miner_hash)
  except Exception:
    print 'oops',miner_hash
