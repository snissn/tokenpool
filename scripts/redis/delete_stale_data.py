import redis
import sys
import json
import time
r = redis.StrictRedis(host='10.142.0.4')
now = time.time()



blocknumber = int(r.get("ethBlockNumber"))
cutoff_blockno = blocknumber - 1000 # 1000 blocks is around 4 hours



def delete_stale_list(prefix):
  for key in r.keys(prefix['prefix']+"*"):
    for index, l in enumerate(r.lrange(key,0,-1)):
      row = json.loads(l)
      seconds = now - row['time']
      hours = seconds / 60/60 
      if hours > prefix['hours']:
        break
    r.ltrim(key, 0, index+1)

prefixes = [{"prefix":b"miner_invalid_share", "hours":1},{"prefix": b"miner_submitted_share","hours":1},{"prefix":b"miner_reward", "hours":24*14}]
for prefix in prefixes:
  delete_stale_list(prefix)

#for key in r.keys("*"):
  #if key.startswith(b"miner_invalid_share") or key.startswith() or key.startswith():
    #for index, l in enumerate(r.lrange(key,0,-1)):
      #row = json.loads(l)
      #seconds = now - row['time']
      #hours = seconds / 60/60 
      #if hours > 24*14:
        ##break
    #r.ltrim(key, 0, index+1)
    #print "r.ltrim(",key, 0, index+1, ")"
#
#




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


