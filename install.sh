set -eux
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs redis-server build-essential

npm install
npm install redis
npm install ethereum-blockies
npm run webpack


sudo apt-get install python3-pip  libssl-dev -y
sudo pip3 install ethereum
