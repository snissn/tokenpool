import redis
import json
import time
now = time.time()
r = redis.StrictRedis(host='10.142.0.4')
pipe = r.pipeline()


i = 0


keys = r.hkeys("submitted_share")
for key in keys:
  data = r.hget("submitted_share",key)
  row = json.loads(data)
  if row["isSolution"]:
    continue # dont delete full solutions
  seconds = now - row['time']
  hours = seconds / 60/60 
  if hours > 24*7:
    pipe.hdel("submitted_share",key)
    if i % (64*1024) == 0:
      print key, data
      #pipe.execute()
    i+=1

import sys
sys.exit(0)




def prune_invalid_shares():

  keys = r.hkeys("invalid_share")
  print len(keys)
  for key in keys:
    data = r.hget("invalid_share",key)
    print data
    row = json.loads(data)
    seconds = now - row['time']
    hours = seconds / 60/60 
    if hours > 2:
      print 'del', key
      r.hdel("invalid_share",key)



prune_invalid_shares()

