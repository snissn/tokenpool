import redis
import json
import time
now = time.time()
r = redis.StrictRedis()
for key in r.keys("*"):
  if key.startswith(b"miner_invalid_share") or key.startswith(b"miner_submitted_share"):
    for index, l in enumerate(r.lrange(key,0,-1)):
      row = json.loads(l)
      seconds = now - row['time']
      days = seconds / 60/60 / 24
      if days > 7:
        break
    r.ltrim(key, 0, index+1)
    print "r.ltrim(",key, 0, index+1, ")"
