import redis
import sys
import time
from web3 import Web3
import json
from multi_pay_contract import Multisend
total_balance = 0

r = redis.Redis(host='10.142.0.4')

addresses = [] 
payouts = []
sent_transactions = {}

sender = Multisend()

payout_addresses = set([b'0xF13e2680a930aE3a640188afe0F94aFCeBe7023b'])
addresses = []

print(addresses)

payout_min = 0
if len(sys.argv) > 1.0:
  payout_user = float(sys.argv[1])
  if payout_user > payout_min:
    payout_min = payout_user


merc = []

for pubkey in r.hgetall("miner_data"):
    #if pubkey not in payout_addresses:
      #continue
    try:
      miner = r.hget("miner_data", pubkey)
      minerData = json.loads(miner.decode())
      balance = int(minerData['tokenBalance'])
      if balance >payout_min*1E8:
          if sender.isInvalidAddress(pubkey):
            print("pubkey is contract", pubkey)
            merc.append([ Web3.toChecksumAddress(pubkey.decode()), balance, pubkey])
            total_balance += balance
            continue
          addresses.append(Web3.toChecksumAddress(pubkey.decode()))
          sent_transactions[pubkey.decode()] = balance
          total_balance += balance
          payouts.append(balance)
          if len(sent_transactions) > 80:
            break
    except Exception:
      print(miner)

print(sent_transactions)
print('total balance',total_balance/1E8)
print(len(sent_transactions))

#if total_balance == 0:
  #sys.exit(0)

print(merc)
#require --pay
if not '--pay' in sys.argv:
  print('no pay')
  sys.exit(0)

print('pay')

if len(sent_transactions) > 0:
  txID = sender.send_many(addresses, payouts, sent_transactions)
  time.sleep(60)
#multi_pay_contract.update_redis(sent_transactions)
for address, satoshis, pubkey in merc:
  print(address, satoshis)
  sender.transfer(address,satoshis, pubkey.decode())
  time.sleep(60)
