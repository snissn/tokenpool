import etherscan 
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

#payout_addresses = set([b'0xF13e2680a930aE3a640188afe0F94aFCeBe7023b'])
payout_addresses = set([b'0x8F70Be8F0c9886D8AA5e756E65b106Cbf3c068A1'])
#payout_addresses = set([b'0x2E361F82edFC9DeBE8ACaAD20d8F75Dcc56101B5'])
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
      if balance > float(payout_min)*1E8 and balance > 3*1E8:
          if sender.isInvalidAddress(pubkey):
            print("pubkey is contract", pubkey)
            merc.append([ Web3.toChecksumAddress(pubkey.decode()), balance, pubkey])
            #total_balance += balance
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

for row in merc:
  print(row, row[1]/1.0e8)
#require --pay
if not '--pay' in sys.argv:
  print('no pay')
  sys.exit(0)

print('pay')
payout_address = '0xdD93Cfb9ABB42F21f8c6D9e9beF2C4F94d7c898A'
payout_contract = '0x9303B501e06aded924b038278eC70fe115260e28'


address_balance = etherscan.payment_token_balance()
contract_balance = etherscan.contract_token_balance()

address_total_satoshis = 0
for address, satoshis, pubkey in merc:
  address_total_satoshis+=satoshis

#address_total_satoshis is how much we need to payout from the 0xdd address. if the balance of the 0xdd adress is greater than address_total_satoshis do nothing otherwise send the difference to the 0xdd address account.

payout_address_difference = address_total_satoshis - address_balance
if payout_address_difference > 0:
  print('sending tokens to the 0xdd wallet account: ' , payout_address_difference /1E8)
  sender.transfer(payout_address,payout_address_difference, payout_address, update_redis=False,sender="mint")
print( "address balance is ", address_balance)

print('first thing value is ', address_total_satoshis)
print('first thing diff value is ', address_total_satoshis - address_balance )
print('first thing diff value  readable is ', float(address_total_satoshis - address_balance )/1E8)


#total_balance is how much we need to send out from the payment contract ( we should rename it lol)
#transfer total_balance - contract_balance to the payout contract, assuming that value is less than 0

payout_contract_token_difference = total_balance - contract_balance
if payout_contract_token_difference > 0:
  print("sending tokens to payouts contract so the payout can succeed", payout_contract_token_difference)
  sender.transfer(payout_contract,payout_contract_token_difference, payout_contract, update_redis=False,sender="mint")

print( "contract balance is ", contract_balance)
print('amount needed second thing value is ', total_balance)
print('second thing diff value is ', total_balance - contract_balance )
print('second thing diff value  readable is ', float(total_balance - contract_balance )/1E8)

if True and len(sent_transactions) > 0:
  txID = sender.send_many(addresses, payouts, sent_transactions)
  time.sleep(60)
#multi_pay_contract.update_redis(sent_transactions)
for address, satoshis, pubkey in merc:
  print(address, satoshis)
  sender.transfer(address,satoshis, pubkey.decode())
  time.sleep(60)
