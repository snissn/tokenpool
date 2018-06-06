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

payout_addresses = set([b'0x10EBc15D60543f2D612120b0114971c634076076'])
addresses = []

print(addresses)

payout_min = 5
if len(sys.argv) > 1:
  payout_user = int(sys.argv[1])
  if payout_user > payout_min:
    payout_min = payout_user


merc = []

for pubkey in r.hgetall("miner_data"):
  #if pubkey not in payout_addresses:
    #continue
    try:
      miner = r.hget("miner_data", pubkey)
      minerData = json.loads(miner.decode())
      balance = int(minerData['tokenBalance']) # Todo remove 1E8 for live
      if balance >payout_min*1E8:
          if sender.isInvalidAddress(pubkey):
            print("pubkey is contract", pubkey)
            merc.append([ Web3.toChecksumAddress(pubkey.decode()), balance, pubkey])
            continue
          addresses.append(Web3.toChecksumAddress(pubkey.decode()))
          sent_transactions[pubkey.decode()] = balance
          total_balance += balance
          payouts.append(balance)
    except Exception:
      print(miner)

print(sent_transactions)
print(total_balance/1E8)
print(len(sent_transactions))

if total_balance == 0:
  sys.exit(0)

print(merc)
#require --pay
if not '--pay' in sys.argv:
  print('no pay')
  sys.exit(0)

print('pay')


txID = sender.send_many(addresses, payouts, sent_transactions)
#multi_pay_contract.update_redis(sent_transactions)
for address, satoshis, pubkey in merc:
  print(address, satoshis)
  sender.transfer(address,satoshis, pubkey.decode())
