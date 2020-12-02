#this is the second script to run, it works effectively and kills old shares 


import redis
import datetime
import json
import time
now = time.time()
r = redis.StrictRedis(host='10.142.0.4')

key = "submitted_shares_list"
print 
for i in range(0,r.llen(key)):
  #print i, r.lindex(key, i)
  row = json.loads(r.lindex(key,i))
  seconds = now - row['time']
  hours = seconds / 60/60 
  if hours > 1:
    break

print i, row
r.ltrim(key, 0, i+1)
