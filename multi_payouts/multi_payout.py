import redis
import sys
import time
from web3 import Web3
import json
from multi_pay_contract import Multisend
total_balance = 0

r = redis.Redis()

addresses = [] 
payouts = []
sent_transactions = {}

sender = Multisend()

for pubkey in r.hgetall("miner_data"):
  #if pubkey != b"0xF13e2680a930aE3a640188afe0F94aFCeBe7023b":
    #continue
  if sender.isInvalidAddress(pubkey):
    print("pubkey is contract", pubkey)
    continue
  miner = r.hget("miner_data", pubkey)
  minerData = json.loads(miner.decode())
  balance = int(minerData['tokenBalance']) # Todo remove 1E8 for live
  if balance >20*1E8:
    try:
      addresses.append(Web3.toChecksumAddress(pubkey.decode()))
      sent_transactions[pubkey.decode()] = balance
      total_balance += balance
      payouts.append(balance)
    except Exception:
      print(miner)

print(sent_transactions)
print(total_balance/1E8)
print(len(sent_transactions))

txID = sender.send_many(addresses, payouts, sent_transactions)
#multi_pay_contract.update_redis(sent_transactions)
