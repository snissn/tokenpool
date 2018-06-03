import web3
from web3.contract import ConciseContract
import sys
import time
from web3 import Web3
from web3 import Web3, HTTPProvider
import eth_utils


import os

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
    self.w3 = Web3( infura_provider)
    self.pub_key,self.private_key = get_keys()
    self.w3.eth.enable_unaudited_features()

  def get_eth_block_number(self):
    return self.w3.eth.blockNumber
  def send_many(self,addresses, values):
    multisend = self.w3.eth.contract( address= "0x1A64f4b6aC7339468b24789E560C9Eb1F9A82CF6" , abi= [{"constant":False,"inputs":[{"name":"_tokenAddr","type":"address"},{"name":"dest","type":"address"},{"name":"value","type":"uint256"}],"name":"send","outputs":[],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":False,"inputs":[],"name":"withdraw","outputs":[],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":True,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":False,"stateMutability":"view","type":"function"},{"constant":False,"inputs":[{"name":"_tokenAddr","type":"address"},{"name":"dests","type":"address[]"},{"name":"values","type":"uint256[]"}],"name":"multisend","outputs":[{"name":"","type":"uint256"}],"payable":False,"stateMutability":"nonpayable","type":"function"},{"constant":False,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":False,"stateMutability":"nonpayable","type":"function"}] ) # first deployed with return
    nonce = self.w3.eth.getTransactionCount(self.pub_key)

    multisend_tx = multisend.functions.multisend("0xB6eD7644C69416d67B522e20bC294A9a9B405B31",addresses,values).buildTransaction({
           #'chainId': web3.eth.net.getId() ,
           'gas': 4700000,
           'from': self.pub_key,
           'gasPrice': self.w3.eth.gasPrice
           'nonce': nonce,
       })
    signed_txn = self.w3.eth.account.signTransaction(multisend_tx, private_key=self.private_key)
    self.w3.eth.sendRawTransaction(signed_txn.rawTransaction)

    hex_transaction = self.w3.toHex(self.w3.sha3(signed_txn.rawTransaction))
    for i in range(90*2): # 90 minutes
      print("checking transaction", hex_transaction)
      confirmation = self.w3.eth.getTransactionReceipt(hex_transaction)
      print("confirmation:", confirmation)
      if confirmation and confirmation['blockNumber']:
        if not confirmation['status']:
          raise
        return hex_transaction
      time.sleep(30)
    raise
