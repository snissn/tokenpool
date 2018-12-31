import web3
import json
from web3.contract import ConciseContract
import sys
import time
from web3 import Web3
from web3 import Web3, HTTPProvider
import eth_utils
import os
import redis

import btc

def get_keys():
  folder = os.path.dirname(os.path.realpath(__file__))
  lines = open(folder+"/../account.config.js").read().splitlines()
  for index, line in enumerate(lines):
    if "payment" in line:
      pub = lines[index+1].split("'")[1].split("'")[0]
      private = lines[index+2].split("'")[1].split("'")[0]
      return pub,private

class Multisend(object):
  def __init__(self):
    infura_provider = HTTPProvider('https://mainnet.infura.io/2IbUn6pXsKwj7z327A4A ')
    #infura_provider = HTTPProvider('http://localhost:8545')
    self.w3 = Web3( infura_provider)
    self.pub_key,self.private_key = get_keys()
    self.w3.eth.enable_unaudited_features()
    print("gas:",  int(self.w3.eth.gasPrice))
  

  def get_eth_block_number(self):
    return self.w3.eth.blockNumber

  def send_many(self,addresses, values, sent_transactions):
    multisend = self.w3.eth.contract( address= "0x9303B501e06aded924b038278eC70fe115260e28" , abi= [{"constant":False,"inputs":[{"name":"_tokenAddr","type":"address"},{"name":"dest","type":"address"},{"name":"value","type":"uint256"}],"name":"send","outputs":[],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":False,"inputs":[{"name":"_tokenAddr","type":"address"},{"name":"ltc","type":"address"},{"name":"dests","type":"address[]"},{"name":"values","type":"uint256[]"}],"name":"multisend2","outputs":[{"name":"","type":"uint256"}],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":False,"inputs":[],"name":"withdraw","outputs":[],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":False,"inputs":[{"name":"tokenAddrs","type":"address[]"},{"name":"numerators","type":"uint256[]"},{"name":"denominators","type":"uint256[]"},{"name":"dests","type":"address[]"},{"name":"values","type":"uint256[]"}],"name":"multisend3","outputs":[{"name":"","type":"uint256"}],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":True,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":False,"stateMutability":"view","type":"function"},{"constant":False,"inputs":[{"name":"_tokenAddr","type":"address"},{"name":"dests","type":"address[]"},{"name":"values","type":"uint256[]"}],"name":"multisend","outputs":[{"name":"","type":"uint256"}],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":False,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":False,"stateMutability":"nonpayable","type":"function"}] )
    
    nonce = self.w3.eth.getTransactionCount(self.pub_key)
    print("gas:",  int(self.w3.eth.gasPrice))

    #multisend_tx = multisend.functions.multisend3(["0xB6eD7644C69416d67B522e20bC294A9a9B405B31", "0x33D99EFc0C3cC4F93dA6931EC2CCcF19Ca874b6D"], [1,4],[1,1] ,addresses,values).buildTransaction({
    #multisend_tx = multisend.functions.multisend3(["0xB6eD7644C69416d67B522e20bC294A9a9B405B31", "0x0F00f1696218EaeFa2D2330Df3D6D1f94813b38f"], [1,1],[1,2] ,addresses,values).buildTransaction({ # sedo
    multisend_tx = multisend.functions.multisend3(["0xB6eD7644C69416d67B522e20bC294A9a9B405B31"], [1],[1] ,addresses,values).buildTransaction({
    #multisend_tx = multisend.functions.multisend3(["0xB6eD7644C69416d67B522e20bC294A9a9B405B31", "0x33D99EFc0C3cC4F93dA6931EC2CCcF19Ca874b6D", "0x291DE53a16b76dfE28551Fd3335225F506dB8b82"], [1,4,1600],[1,1,50] ,addresses,values).buildTransaction({
           #'chainId': web3.eth.net.getId() ,
           'gas': 6216028,
           'from': self.pub_key,
           'gasPrice': int(self.w3.eth.gasPrice*1.2),
           'nonce': nonce,
       })
    signed_txn = self.w3.eth.account.signTransaction(multisend_tx, private_key=self.private_key)
    self.w3.eth.sendRawTransaction(signed_txn.rawTransaction)

    hex_transaction = self.w3.toHex(self.w3.sha3(signed_txn.rawTransaction))
    for i in range(360*2*10): # 6 hours
      print("checking transaction", hex_transaction)
      confirmation = self.w3.eth.getTransactionReceipt(hex_transaction)
      print("confirmation:", confirmation)
      if confirmation and confirmation['blockNumber']:
        if not confirmation['status']:
          raise
        return self.update_redis(sent_transactions, hex_transaction)
      time.sleep(30)
    raise

  def update_redis(self, sent_transactions, hex_transaction):
    eth_block = self.get_eth_block_number()
    r = redis.Redis(host='10.142.0.4')
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
      balance_payments = {"id" : hex_transaction, "minerAddress" : upubkey, "previousTokenBalance": satoshis, "newTokenBalance" : data['tokenBalance'] , "block": eth_block, "time": time.time()}
      balance_payments = json.dumps(balance_payments)
      r.lpush(b"balance_payments:" + pubkey, balance_payments)
#update balance_payments

#update balance_transfers
      balance_transfers = { "addressTo": upubkey, "balancePaymentId": hex_transaction, "tokenAmount" : satoshis, "txHash": hex_transaction, "block":eth_block, "confirmed": True, "time":time.time()}
      balance_transfers = json.dumps(balance_transfers)
      r.lpush(b"balance_transfers:" + pubkey, balance_transfers)
#"{\"addressTo\":\"0xae421cdee3ac61d85c2e1da253ce44ee9e354df6\",\"balancePaymentId\":\"0x47b989bd64134013cf2910b5f5ad33513092cdce8d917275b4d74269de40e0eb\",\"tokenAmount\":2505272293,\"txHash\":\"0x4f96b5996f02ad759b97ba4f580f899329d48349c534d371e58ea1739c693fdc\",\"block\":5706462,\"confirmed\":false}"
#update balance_transfers

  def isInvalidAddress(self, address): # not a contract
    try:
      return len(self.w3.eth.getCode(Web3.toChecksumAddress(address.decode()))) > 0
    except Exception as oops:
      print(oops)
      return False

  def transfer(self, address, value, pubkey):
  
    ebtc = self.w3.eth.contract( address=btc.address, abi=btc.abi )
    print(ebtc.functions.transfer)
    nonce = self.w3.eth.getTransactionCount(self.pub_key)
    print({'gasPrice': int(self.w3.eth.gasPrice/1)})
    multisend_tx = ebtc.functions.transfer(address, value).buildTransaction({
           #'chainId': web3.eth.net.getId() ,
           'gas': 62608,
           'from': self.pub_key,
           'gasPrice': int(self.w3.eth.gasPrice/1),
           'nonce': nonce,
       })
    signed_txn = self.w3.eth.account.signTransaction(multisend_tx, private_key=self.private_key)
    self.w3.eth.sendRawTransaction(signed_txn.rawTransaction)

    hex_transaction = self.w3.toHex(self.w3.sha3(signed_txn.rawTransaction))
    for i in range(360*2*10): # 6 hours
      print("checking transaction", hex_transaction)
      confirmation = self.w3.eth.getTransactionReceipt(hex_transaction)
      print("confirmation:", confirmation)
      if confirmation and confirmation['blockNumber']:
        if not confirmation['status']:
          raise
        return self.update_one( pubkey, value, hex_transaction)
      time.sleep(30)
    raise

  def update_one(self, address, value, hex_transaction):
    eth_block = self.get_eth_block_number()
    r = redis.Redis(host='10.142.0.4')
    data = r.hget("miner_data",address)
    pubkey = address#.encode()
    print(data)
    data = json.loads(data.decode())
    data['tokenBalance'] -= value
    data['tokensAwarded'] += value
    print(data)
    r.hset(b"miner_data",address,json.dumps(data).encode())

    balance_payments = {"id" : hex_transaction, "minerAddress" : pubkey, "previousTokenBalance": value, "newTokenBalance" : data['tokenBalance'] , "block": eth_block, "time": time.time()}
    balance_payments = json.dumps(balance_payments)
    r.lpush("balance_payments:" + pubkey, balance_payments)

    balance_transfers = { "addressTo": pubkey, "balancePaymentId": hex_transaction, "tokenAmount" : value, "txHash": hex_transaction, "block":eth_block, "confirmed": True, "time":time.time()}
    balance_transfers = json.dumps(balance_transfers)
    r.lpush("balance_transfers:" + pubkey, balance_transfers)
