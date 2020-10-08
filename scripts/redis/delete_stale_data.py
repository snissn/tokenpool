import redis
import sys
import json
import time
r = redis.StrictRedis(host='10.142.0.4')
now = time.time()



blocknumber = int(r.get("ethBlockNumber"))
cutoff_blockno = blocknumber - 1000 # 1000 blocks is around 4 hours





for key in r.keys("*"):
  if key.startswith(b"miner_invalid_share") or key.startswith(b"miner_submitted_share"):
    for index, l in enumerate(r.lrange(key,0,-1)):
      row = json.loads(l)
      seconds = now - row['time']
      hours = seconds / 60/60 
      if hours > 2:
        break
    r.ltrim(key, 0, index+1)
    print "r.ltrim(",key, 0, index+1, ")"






key =  "active_transactions_list"
for index, l in enumerate(r.lrange(key,0,-1)):
  row = json.loads(l)
  print row
  block = row['block']
  if block < cutoff_blockno:
    break
r.ltrim(key, 0, index+1)
print "r.ltrim(",key, 0, index+1, ")"





key =  "active_transactions"

for hkey in r.hgetall(key):
  row = r.hget(key,hkey)
  row = json.loads(row)
  if row['block'] < cutoff_blockno:
    r.hdel(key,hkey)
    print row




key = "unconfirmed_submitted_solution_tx"
for hkey in r.hgetall(key):
  row = r.hget(key,hkey)
  row = json.loads(row)
  if row['block'] < cutoff_blockno:
    r.hdel(key,hkey)
    print row


