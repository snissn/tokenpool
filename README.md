### Token Mining Pool  

Developed by the 0xBitcoin Community

(GNU PUBLIC LICENSE)

A pool for mining ERC918 Tokens

### BASIC SETUP  (needs Node8)
1. npm install -g node-gyp
1. sudo apt-get install build-essential
2. npm install
3. npm run webpack  #(to build the website files)
4. rename 'sample.account.config.js' to 'account.config.js' and fill it with the pool's ethereum account data

5. install redis-server and make sure it is running
6. Edit pool.config.js to your tastes
7. Edit the website files in /app  to change the look of the website
8. npm run server #(or npm run server test for Ropsten test net)
9. Deploy the multisend payouts contract (https://remix.ethereum.org) 
10. Deploy the mint helper contract (https://remix.ethereum.org) and update account.config.js with that address 
11. update the first argument of multi_payouts/multi_pay-contract.py to your payouts contract address
12. run python3 deps - pip3 install web3
13. run multi_payouts/run.sh in a tmux window / permanent shell so that it sends payouts every 24 hours
14. run scripts/redis/run.sh in a tmux window / permanent shell to regularly purge old data in redis 


### HOW TO USE
1. Point a poolminer at your pool using http://localhost:8080  (or ipaddress:8080 or domain.com:8080)  (make sure firewall allows this port)
2. View website interface at http://localhost (you can set up nginx to serve the static files in /public)

