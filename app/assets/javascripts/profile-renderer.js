const $ = require('jquery');
import Vue from 'vue';
var moment = require('moment');
var Chart = require('chart.js');
var _ = require('lodash');

var io = require('socket.io-client');
var renderUtils = require('./render-utils')


var minerBalancePaymentsList;
var minerBalanceTransfersList;
var minerSubmittedSharesList;
var minerInvalidSharesList;
var minerRewardsList;

var jumbotron;

var minerAddress = null;

export default class ProfileRenderer {


  init() {

    minerAddress = this.getAccountUrlParam();

    if (minerAddress == null) return

    var self = this;

    setInterval( function(){

      self.update();


    },15*1000);


    this.initSockets();

  }


  initSockets() {

    var self = this;

    var current_hostname = window.location.hostname;

    const socketServer = 'http://' + current_hostname + ':2095';

    const options = {
      transports: ['websocket'],
      forceNew: true
    };
    this.socket = io(socketServer, options);

    this.socket.on('connect', () => {
      console.log('connected to socket.io server');
    });


    this.socket.on('disconnect', () => {
      console.log('disconnected from socket.io server');
    });



    this.socket.on('minerDetails', function (data) {



     data.address = minerAddress;
     data.etherscanURL = 'https://etherscan.io/token/0xb6ed7644c69416d67b522e20bc294a9a9b405b31?a=' + minerAddress.toString();

      data.tokensAwardedFormatted = self.formatTokenQuantity(data.tokensAwarded);
      data.sedoTokensAwardedFormatted = self.formatTokenQuantity(data.sedoTokensAwarded);

      data.tokenBalanceFormatted = self.formatTokenQuantity(data.tokenBalance);

      data.sedoTokenBalanceFormatted = self.formatTokenQuantity(data.sedoTokenBalance);

      data.hashRateFormatted = renderUtils.formatHashRate(data.hashRate);

      console.log('got miner details')
      console.dir(data);


      Vue.set(jumbotron.miner, 'minerData', data)

    });


    this.socket.on('minerBalancePayments', function (data) {


     data.map(item => item.previousTokenBalanceFormatted  = self.formatTokenQuantity(item.previousTokenBalance)    )
     data.map(item => item.previousSedoTokenBalanceFormatted  = self.formatTokenQuantity(item.previousSedoTokenBalance)    )
     data.map(item => item.time  = self.ethBlockNumberToDateStr(item.block)    )

      console.log('got minerBalancePayments')
      console.dir(data);

      Vue.set(minerBalanceTransfersList, 'payoutTransactions', {
        tx_list: data.slice(0, 50)
      })

    });

    this.socket.on('minerBalanceTransfers', function (data) {

      data.map(item => item.etherscanTxURL = item.txHash ? ('https://etherscan.io/tx/' + item.txHash.toString()) : "")

      data.map(item => item.tokenAmountFormatted = self.formatTokenQuantity(item.tokenAmount))

     data.map(item => item.time  = self.ethBlockNumberToDateStr(item.block)    )

      console.log('got minerBalanceTransfers')
      console.dir(data);

      Vue.set(minerBalanceTransfersList, 'transactions', {
        tx_list: data
      })

    });

    this.socket.on('minerSubmittedShares', function (data) {

      console.log('got minerSubmittedShares')
      console.dir(data);

      data.map(item => item.timeFormatted = self.formatTime(item.time))

      data.map(item => item.hashRateFormatted = renderUtils.formatHashRate(item.hashRateEstimate))


      Vue.set(minerSubmittedSharesList, 'shares', {
        share_list: data.slice(0, 50)
      })

    });

    this.socket.on('minerRewards', function (data) {


      data.map(item => item.timeFormatted = self.formatTime(item.time))
      data.map(item => item.txlink = "https://etherscan.io/tx/"+item.id );
      console.log('got minerReward', data)
      Vue.set(minerRewardsList, 'rewards', {
        share_list: data.slice(0, 50)
      })

    });

    this.socket.on('minerInvalidShares', function (data) {

      console.log('got minerInvalidShares')
      console.dir(data);

      data.map(item => item.timeFormatted = self.formatTime(item.time))


      Vue.set(minerInvalidSharesList, 'shares', {
        share_list: data.slice(0, 50)
      })

    });

    const createChart = (elementId, labels, data, label) => {
      const context = document.getElementById(elementId);
      const submittedCanvas = new Chart(context, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: label,
            data: data,
            borderColor: "rgb(75, 192, 192)",
            lineTension: 0.1,
            fill: false
          }]
        },
        options: {
          animation: {
            duration: 0,
          },
          scales: {
            yAxes: [{
              ticks: {
                beginAtZero: true
              }
            }]
          }
        }
      });
    }


    jumbotron = new Vue({
      el: '#jumbotron',
      data: {
        miner: {
          minerData: {
            address: minerAddress,
            etherscanURL: ('https://etherscan.io/address/' + minerAddress.toString())
          },
        }
      }
    });


    minerBalancePaymentsList = new Vue({
      el: '#minerBalancePaymentsList',
      data: {
        transactions: {
          tx_list: []
        }
      }
    })

    minerBalanceTransfersList = new Vue({
      el: '#minerBalanceTransfersList',
      data: {
        transactions: {
          tx_list: []
        },
        payoutTransactions: {
          tx_list: []
        },
      },
      methods: {
        leftJoin(left, right, left_id, right_id) {
          var result = [];
          _.each(left, function (litem) {
            var f = _.filter(right, function (ritem) {
              return ritem[right_id] == litem[left_id];
            });
            if (f.length == 0) {
              f = [{}];
            }
            _.each(f, function (i) {
              var newObj = {};
              _.each(litem, function (v, k) {
                newObj[k] = v;
              });
              _.each(i, function (v, k) {
                newObj[k] = v;
              });
              result.push(newObj);
            });
          });
          return result;
        }
      },
      computed: {
        newTransactions() {
          return this.leftJoin(this.payoutTransactions.tx_list, this.transactions.tx_list, "id", "balancePaymentId")
        }
      }
    })

    minerSubmittedSharesList = new Vue({
      el: '#minerSubmittedSharesList',
      data: {
        shares: {
          share_list: []
        }
      },
      updated() {
        const labels = this.shares.share_list.map(share => share.timeFormatted).reverse();
        const data = this.shares.share_list.map(share => share.difficulty).reverse();
        createChart("submittedCanvas", labels, data, "Difficulty");
      },
    })

    minerRewardsList = new Vue({
      el: '#minerRewardsList',
      data: {
        rewards: {
          reward_list: []
        },
      },
    })

    minerInvalidSharesList = new Vue({
      el: '#minerInvalidSharesList',
      data: {
        shares: {
          share_list: []
        },
      },
      updated() {
        const labels = this.shares.share_list.map(share => share.timeFormatted).reverse();
        const data = this.shares.share_list.map(share => share.difficulty).reverse();
        createChart("invalidCanvas", labels, data, "Difficulty");
      },
    })

    this.socket.emit('getMinerDetails', {
      address: minerAddress
    });

    this.socket.emit('getMinerBalancePayments', {
      address: minerAddress
    });
    this.socket.emit('getMinerBalanceTransfers', {
      address: minerAddress
    });
    this.socket.emit('getMinerSubmittedShares', {
      address: minerAddress
    });

    this.socket.emit('getMinerInvalidShares', {
      address: minerAddress
    });
    this.socket.emit('getMinerRewards', {
      address: minerAddress
    });




  }

  getAccountUrlParam() {

    let url = new URL(window.location.href);
    let searchParams = new URLSearchParams(url.search);
    console.log('address in url ', searchParams.get('address'));


    return searchParams.get('address');
  }

  update() {

    this.socket.emit('getMinerDetails', {
      address: minerAddress
    });

    this.socket.emit('getMinerBalancePayments', {
      address: minerAddress
    });
    this.socket.emit('getMinerBalanceTransfers', {
      address: minerAddress
    });
    this.socket.emit('getMinerSubmittedShares', {
      address: minerAddress
    });
    this.socket.emit('getMinerInvalidShares', {
      address: minerAddress
    });
    this.socket.emit('getMinerRewards', {
      address: minerAddress
    });

  }

  formatTime(time) {
    if (time == null || time == 0) {
      return "--";
    }

    return moment.unix(time).format('MM/DD HH:mm');
  }

  formatTokenQuantity(satoshis) {
    var quantity = (parseFloat(satoshis) / parseFloat(1e8)).toFixed(2)
    if(isNaN(quantity)){
      quantity = 0.0;
      quantity = quantity.toFixed(2);
    }
    return quantity;
  }

ethBlockNumberToDateStr(eth_block) {
  var block_data = new Date("Mon Apr 30 2018 7:00:23 GMT-0400 (EDT)");
  var latest_eth_block = 5532002;
  return new Date(Date.now() - ((latest_eth_block - eth_block)*15*1000)).toLocaleString()
}


  /*
    let url = new URL('http://www.test.com/t.html?a=1&b=3&c=m2-m3-m4-m5');
    let searchParams = new URLSearchParams(url.search);
    console.log(searchParams.get('c'));

  */


}
