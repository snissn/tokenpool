import web3
from web3.contract import ConciseContract
import sys
import time
from web3 import Web3
from web3 import Web3, HTTPProvider
import eth_utils

infura_provider = HTTPProvider('https://mainnet.infura.io/2IbUn6pXsKwj7z327A4A ')
w3 = Web3( infura_provider)
confirmation = w3.eth.getTransactionReceipt("0x58ab7616bcc004bc3619bd443fecdf4357dfe54a84acb3280485a5b374da69bb")
confirmation = w3.eth.getTransactionReceipt("0x07778610fb6cef63d6c322dd8f5027bb5b7e103bdb78acf614be12a1063770aa")

print(w3.eth.blockNumber)
print(w3.eth.blockNumber - confirmation['blockNumber'] )
'''
print ({'gasPrice': int(w3.eth.gasPrice)})
print ({'gasPrice': int(1.2*w3.eth.gasPrice)})


c = w3.eth.getCode(Web3.toChecksumAddress("0xc8f876836db93986a6e05ab3a1056817dd824464"))
print(len(c))
c = w3.eth.getCode(Web3.toChecksumAddress("0xF13e2680a930aE3a640188afe0F94aFCeBe7023b"))
print(len(c))
'''
