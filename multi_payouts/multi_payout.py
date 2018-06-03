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
for pubkey in r.hgetall("miner_data"):
  #if pubkey != b"0xf490043f4a0DCdAeD0C071cb8707Bdd9598C5B9f":
    #continue
  miner = r.hget("miner_data", pubkey)
  minerData = json.loads(miner.decode())
  balance = int(minerData['tokenBalance']) # Todo remove 1E8 for live
  if balance >20*1E8 :
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
#sys.exit(0)


sender = Multisend()
eth_block = sender.get_eth_block_number()
txID = sender.send_many(addresses, payouts)
for pubkey in sent_transactions:
#update balances
  upubkey = pubkey
  data = r.hget("miner_data",pubkey)
  satoshis = sent_transactions[pubkey]
  pubkey = pubkey.encode()
  print(data)
  data = json.loads(data.decode())
  data['tokenBalance'] -= satoshis
  data['tokensAwarded'] += satoshis
  print(data)
  r.hset(b"miner_data",pubkey,json.dumps(data).encode())
#update balances

#update balance_payments
  balance_payments = {"id" : txID, "minerAddress" : upubkey, "previousTokenBalance": satoshis, "newTokenBalance" : data['tokenBalance'] , "block": eth_block, "time": time.time()}
  balance_payments = json.dumps(balance_payments)
  r.lpush(b"balance_payments:" + pubkey, balance_payments)
#update balance_payments

#update balance_transfers
  balance_transfers = { "addressTo": upubkey, "balancePaymentId": txID, "tokenAmount" : satoshis, "txHash": txID, "block":eth_block, "confirmed": True, "time":time.time()}
  balance_transfers = json.dumps(balance_transfers)
  r.lpush(b"balance_transfers:" + pubkey, balance_transfers)
#"{\"addressTo\":\"0xae421cdee3ac61d85c2e1da253ce44ee9e354df6\",\"balancePaymentId\":\"0x47b989bd64134013cf2910b5f5ad33513092cdce8d917275b4d74269de40e0eb\",\"tokenAmount\":2505272293,\"txHash\":\"0x4f96b5996f02ad759b97ba4f580f899329d48349c534d371e58ea1739c693fdc\",\"block\":5706462,\"confirmed\":false}"
#update balance_transfers
