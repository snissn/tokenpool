import redis
import sys
import json
import time
r = redis.StrictRedis(host='10.142.0.4')

key =  "active_transactions_list"
for index, l in enumerate(r.lrange(key,0,-1)):
  row = json.loads(l)
  print row
  continue
  block = row['block']
  if block < 5714128:
    break
r.ltrim(key, 0, index+1)
print "r.ltrim(",key, 0, index+1, ")"

sys.exit(0)




key =  "active_transactions"

for hkey in r.hgetall(key):
  row = r.hget(key,hkey)
  row = json.loads(row)
  if row['block'] < 5714128:
    r.hdel(key,hkey)
    print row
