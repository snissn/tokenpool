

/*

Turns queued ethereum transaction into actual ones :)

Waits for pending TX to be mined before sending another !

Solutions are highest priority

*/

var cluster = require('cluster')

const Tx = require('ethereumjs-tx')

var web3Utils = require('web3-utils')

 var lastRebroadcastBlock = 0;


module.exports =  {

  async init(web3,tokenContract,mintHelperContract, poolConfig,accountConfig,redisInterface,tokenInterface)
  {
    this.web3=web3;
    this.redisInterface=redisInterface;
    this.tokenContract = tokenContract;
    this.mintHelperContract  = mintHelperContract;
    this.tokenInterface = tokenInterface;
    this.accountConfig= accountConfig;
    this.poolConfig= poolConfig;
    this.mergeMintTokens = this.poolConfig.mergeMintTokens;

      var self=this;

        setTimeout(function(){self.broadcastQueuedTransactions()},1000)
  //      setTimeout(function(){self.resendUnbroadcastedPayments()},0)
        setTimeout(function(){self.updateBroadcastedTransactionStatus()},1000)
  },

  /*
  KEY
  queued - transaction not broadcasted yet
  pending - transaction broadcasted but not mined
  mined - transaction mined !
  successful - transaction mined and not reverted

  */
  async getEthBlockNumber()
  {
    try{
    var self = this;
    var result = parseInt( await self.redisInterface.loadRedisData('ethBlockNumber' ));

    if(isNaN(result) || result < 1) result = 0 ;

    return result
    }catch($e){
      console.log("ERROR GETTING BLOCK NUMBER", $e)
      return 0;
    }
  },


//types are 'transfer','solution'
  async addTransactionToQueue(txType,txData)
  {

    //add to redis

    var receiptData = {
      queued:true,
      pending:false,
      mined:false,
      success:false,
    }
    var blockNum  = await this.getEthBlockNumber();

    var packetData = {
      block: blockNum,
      txType: txType,
      txData: txData,
       receiptData: receiptData
     }

     console.log( '\n\n' )

     console.log( ' addTransactionToQueue ',  packetData )

    //packt data is undefined !!
    await this.redisInterface.pushToRedisList('queued_transactions',JSON.stringify(packetData) )

  },



  async markTransactionAsLost(tx_hash,packetData)
  {

    console.log('mark transaction as lost !!!! ')

    await this.redisInterface.pushToRedisList("lost_transactions_list", JSON.stringify(packetData))

    var packetDataJSON = await this.redisInterface.findHashInRedis('active_transactions',tx_hash);
    var packetData = JSON.parse(packetDataJSON)


    packetData.receiptData = {  //lost
          queued:false,
          pending:false,
          mined:false,
          success:false,
          lost: true
        }


          //resave
      var storage_success = await this.storeEthereumTransaction(tx_hash,packetData);


  },


  //broadcasted to the network
  async storeEthereumTransaction(tx_hash,packetData)
  {

    console.log('storing data about eth tx ', tx_hash, packetData )


    await this.redisInterface.storeRedisHashData('active_transactions',tx_hash,JSON.stringify(packetData) )


    var listPacketData = packetData;
    listPacketData.txHash = tx_hash;

    await this.redisInterface.pushToRedisList('active_transactions_list', JSON.stringify(listPacketData))

    var ethereumTransactionHashes = await this.redisInterface.getResultsOfKeyInRedis('active_transactions')

    for(i in ethereumTransactionHashes)
    {
      var txHash = ethereumTransactionHashes[i];
      if (txHash == false) exit() //emergency kill switch to debug
    }

    return true
  },


  async getPacketReceiptDataFromWeb3Receipt(liveTransactionReceipt)
  {

    var mined = (liveTransactionReceipt != null  )
    var success = false

    if( mined )
    {
        let val_to_check = liveTransactionReceipt.status;
        if (val_to_check === true) {
          val_to_check = '0x1';
        } else if (val_to_check === false) {
          val_to_check = '0x0';
        } else {
          val_to_check = liveTransactionReceipt.status;
        }
        success =  (web3Utils.hexToNumber( val_to_check ) == 1 )
    }

    var receiptData = {
      queued:false,
      pending:!mined,
      mined:mined,
      success:success
    }


    return receiptData;


  },



  /*

  get current eth block

  find all the unbroadcasted eth transactions older than 1000 blocks

  check to see if theres a receipt yet - if there is one, pop + mark confirmed

  If there is not a receipt yet, build a new queuedTX  --



  */

/*  async resendUnbroadcastedPayments()
  {
    var self = this;
    console.log('resendUnbroadcastedPayments')
     var current_block =await this.getEthBlockNumber();



     var unconfirmed_payment_json = await this.redisInterface.popFirstFromRedisList('unconfirmed_broadcasted_payments') ;

     if( unconfirmed_payment_json != null )
     {
     var unconfirmed_payment = JSON.parse(unconfirmed_payment_json)

       if( unconfirmed_payment.last_broadcast_block < (current_block-1000) )
       {
          //get the full data from  storeRedisHashData('broadcasted_payment'    and check for a receipt with a good sent balance

          //check to see if there is some sort of saved receipt


          console.log('unconfirmed_payment',unconfirmed_payment)
       }else{

         console.log('unconfirmed_payment pushing back ',unconfirmed_payment)
         await this.redisInterface.pushToRedisList('unconfirmed_broadcasted_payments', JSON.stringify(unconfirmed_payment)) ;


       }

     }


     setTimeout(function(){self.resendUnbroadcastedPayments()},2000);

  },

  */

  /*
  This may have a bug in which tons of pending tx all go to queued.... which is bad.


  */
  async broadcastQueuedTransactions(){

    var self = this;

    var transactionStats = await this.getTransactionStatistics(); // .queuedCount .pendingCount  .minedCount

    var hasPendingTransaction = true;


    var nextQueuedTransactionDataJSON = await this.redisInterface.peekFirstFromRedisList('queued_transactions'  );


    var nextQueuedTransactionData = JSON.parse(nextQueuedTransactionDataJSON)

    if(nextQueuedTransactionData!=null && nextQueuedTransactionData.txType == 'transfer')
    {
      hasPendingTransaction = (transactionStats.pendingPaymentsCount > 0);
    }

    if(nextQueuedTransactionData!=null && nextQueuedTransactionData.txType == 'solution')
    {
      hasPendingTransaction = (transactionStats.pendingMintsCount > 0);
    }

    var hasQueuedTransaction = (transactionStats.queuedCount > 0)

       if( hasQueuedTransaction && !hasPendingTransaction ){

          try{


             var nextQueuedTransactionData = await this.redisInterface.popFromRedisList('queued_transactions'  )
             console.log('nextQueuedTransactionData',nextQueuedTransactionData)
             //getNextQueuedTransaction()

             nextQueuedTransaction = JSON.parse(nextQueuedTransactionData)

             var successful_broadcast = await this.broadcastTransaction(nextQueuedTransaction, false);

             if(!successful_broadcast)
             {
               console.error('unsuccessful broadcast ! ')

               //this is putting in a bad entry !! like 'true '
               //   await this.redisInterface.pushToRedisList('queued_transactions',nextQueuedTransactionData)
             }

          }
          catch(e)
          {
          console.log('error',e);
          }
       }
       setTimeout(function(){self.broadcastQueuedTransactions()},1000*30)

   },




   async updateLastBroadcastDataForTx(txHash,broadcastData)
   {
      var broadcastAtBlock ;
      var accountTxNonce ;



   },


   async broadcastTransaction(transactionPacketData,resending)
   {
    var receiptData = transactionPacketData.receiptData;
    var txData = transactionPacketData.txData;
    var txType = transactionPacketData.txType;

    console.log('\n')
     console.log('\n')
    console.log('---- broadcast transaction ---',txType,txData)

    var tx_hash = null;

    if(txType == 'transfer'){
      return false;

          var addressFrom = this.getPaymentAccount().address;


          if(txData == null || txData.addressTo == addressFrom )
          {
            console.log('cant send transfer to self!!' )
            return false;
          }

          var tx_hash = await this.transferTokensFromPool(txData.addressTo, txData.tokenAmount, txData.balancePaymentId , resending)


    }else if(txType=="solution"){
          var currentChallengeNumber = await this.requestCurrentChallengeNumber();

          if(txData == null || currentChallengeNumber !=  txData.challenge_number )
          {
            console.log('stale challenge number!  Not submitting solution to contract ' )
            //return false;
          }



            var submitted_solution = await this.submitMiningSolution(txData.minerEthAddress,txData.solution_number,txData.challenge_digest,txData.challenge_number, resending)
            console.log("submitted_solution", submitted_solution);
            var tx_hash = submitted_solution['tx_hash']
            var merge_mining_addresses = submitted_solution['merge_mining_addresses']


    }else{
      console.error('invalid tx type!',txType)
      return false;
    }

    if(tx_hash == null){
      console.error('Tx not broadcast successfully',txType,txData )

      ///Store new transfer data with a null tx_hash  which we will pick up later and then grab a receipt for !!!
      if(txType =="transfer"){
        await this.storeNewSubmittedTransferData(null, txData.addressTo, txData.balancePaymentId, txData.tokenAmount )
      }

      return false;
    }else{
      console.log('broadcasted transaction -> ',tx_hash,txType,txData)

      if( txType=="solution"){
        await this.storeNewSubmittedSolutionTransactionHash(tx_hash, txData.tokenReward, txData.minerEthAddress, txData.challenge_number, merge_mining_addresses )
      }

      if(txType =="transfer"){
        await this.storeNewSubmittedTransferData(tx_hash, txData.addressTo, txData.balancePaymentId, txData.tokenAmount )
      }

      transactionPacketData.receiptData = {
            queued:false,
            pending:true,
            mined:false,
            success:false,
          }

          /*
          var receiptData = {
            queued:false,
            pending:true,
            mined:false,
            success:false,
          }

          var packetData = {txType: txType, txData: txData, receiptData: receiptData}
          */

            //resave
        var storage_success = await this.storeEthereumTransaction(tx_hash,transactionPacketData);


        return true

    }

  },




   async updateBroadcastedTransactionStatus()
   {

    if (!cluster.isMaster) { return; }

     var self = this;

     try{

     var ethereumTransactionHashes = await this.redisInterface.getResultsOfKeyInRedis('active_transactions')

     for(i in ethereumTransactionHashes)
     {
       var txHash = ethereumTransactionHashes[i];


        var packetDataJSON = await this.redisInterface.findHashInRedis('active_transactions',txHash);

        var packetData = JSON.parse(packetDataJSON)


          // console.log('update broadcated tx ',packetData)
          //  console.log('packetData',packetData)


      if(packetData.receiptData.mined == false && packetData.receiptData.lost != true  ){


              var txResponse = await this.requestTransactionData(txHash)
             var receipt = await this.requestTransactionReceipt(txHash)

             if( txResponse != null )
             {
             var isPending = (txResponse.transactionIndex != null)
           }

             if(receipt!=null)
             {

               packetData.receiptData = await this.getPacketReceiptDataFromWeb3Receipt(receipt)

              await this.storeEthereumTransaction(txHash,packetData);

             }else {

               var current_block =await this.getEthBlockNumber();
               var pending_block= packetData.block ;



                var LOST_TX_BLOCK_COUNT = 50



               //rebroadcast
               if( current_block - pending_block > LOST_TX_BLOCK_COUNT  && pending_block > 0  /* && current_block - lastRebroadcastBlock > 100  */ )
               {
                  lastRebroadcastBlock = current_block;
                   await this.markTransactionAsLost( txHash , packetData)
                  //this.storeEthereumTransaction(txHash,packetData);

               }

             }
       }

     }

     }catch(e)
     {
        //console.log('error',e)
     }

      setTimeout(function(){self.updateBroadcastedTransactionStatus()},2000*30)
   },




      async getTransactionStatistics()
      {
        var pendingCount = 0;
        var queuedCount = 0;
        var minedCount = 0;
        var successCount = 0;

        var pendingMintsCount = 0;
        var pendingPaymentsCount = 0;

        var queuedTransactions = await this.redisInterface.getElementsOfListInRedis('queued_transactions')

        var ethereumTransactionHashes = await this.redisInterface.getResultsOfKeyInRedis('active_transactions')

        var ethereumTransactions = [];

        for(i in ethereumTransactionHashes){
          var hash = ethereumTransactionHashes[i];
        //  console.log( 'hash',hash)
          ethereumTransactions.push( await this.redisInterface.findHashInRedis('active_transactions',hash) )
        }



        var transactionPacketsData = []

        queuedTransactions.map(item => transactionPacketsData.push(JSON.parse(item)))
        ethereumTransactions.map(item => transactionPacketsData.push(JSON.parse(item)))

//        console.log('transactionPacketsData',transactionPacketsData)

        transactionPacketsData.map(function(item){

        //  console.log('item',item)


          var receiptData = item.receiptData;


          if(receiptData.pending){
            pendingCount++;

            if(item.txType == 'transfer')
            {
                pendingPaymentsCount++;
            }
            if(item.txType == 'solution')
            {
                pendingMintsCount++;
            }
          }


          if(receiptData.queued)queuedCount++;
          if(receiptData.mined)minedCount++;
          if(receiptData.success)successCount++;

        })


          await this.redisInterface.storeRedisData('queuedTxCount',queuedCount);
          await this.redisInterface.storeRedisData('pendingTxCount',pendingCount);
          await this.redisInterface.storeRedisData('minedTxCount',minedCount);
          await this.redisInterface.storeRedisData('successTxCount',successCount);
          await this.redisInterface.storeRedisData('pendingMintsCount',pendingMintsCount);
          await this.redisInterface.storeRedisData('pendingPaymentsCount',pendingPaymentsCount);

       var stats =  {
         queuedCount: queuedCount,
         pendingCount: pendingCount,
         minedCount: minedCount,
         successCount: successCount,
         pendingMintsCount: pendingMintsCount,
         pendingPaymentsCount: pendingPaymentsCount
       }

       return stats;




      },





     async requestTransactionData(tx_hash)
     {

          var data = await this.web3.eth.getTransaction(tx_hash);

          return data;
     },



   async requestTransactionReceipt(tx_hash)
   {

        var receipt = await this.web3.eth.getTransactionReceipt(tx_hash);

        return receipt;
   },


   //required for balance payouts
      async storeNewSubmittedSolutionTransactionHash(tx_hash, tokensAwarded, minerEthAddress, challengeNumber, merge_mining_addresses)
      {
        var blockNum = await this.getEthBlockNumber();

        var txData = {
          block: blockNum,
          tx_hash: tx_hash,
          minerEthAddress: minerEthAddress,
          challengeNumber: challengeNumber,
          mined: false,  //completed being mined ?
          succeeded: false,
          token_quantity_rewarded: tokensAwarded,
          merge_mining_addresses: merge_mining_addresses,
          rewarded: false   //did we win the reward of 50 tokens ?
        }

          console.log('Storing submitted solution data ', txData)
         this.redisInterface.storeRedisHashData('unconfirmed_submitted_solution_tx',tx_hash,JSON.stringify(txData) )
      },


      /*
        This method is deprecated as it cannot handle TX that fail to broadcast

      */
      async storeNewSubmittedTransferData(txHash, addressTo, balancePaymentId, tokenAmount)
      {

            var blockNumber = await this.getEthBlockNumber();


            var balanceTransferData = {
              addressTo: addressTo,
              balancePaymentId: balancePaymentId,
              tokenAmount: tokenAmount,
              txHash: txHash,
              block:blockNumber,
              confirmed: false
            }

              console.log('Storing new submitted transfer data',('balance_transfers:'+addressTo.toString()),balanceTransferData)

            //helps audit payouts
            //this guy never gets updated and so should not be used
          await this.redisInterface.pushToRedisList(('balance_transfers:'+addressTo.toString()), JSON.stringify(balanceTransferData)  )


          await this.redisInterface.storeRedisHashData('balance_transfer',balancePaymentId, JSON.stringify(balanceTransferData)  )

        },




      //miner address
     async transferTokensFromPool(ethMinerAddress, amount, balancePaymentId, resending)
     {

          var addressTo = this.tokenContract.options.address;


          var addressFrom = this.getPaymentAccount().address;
 
          var transferMethod = this.tokenContract.methods.transfer(addressTo,amount);



            //save data
          var ethBlock = await this.getEthBlockNumber();


          var paymentConfirmed = await this.getBalanceTransferConfirmed(balancePaymentId);


        /*  var broadcastedPaymentData = {
             balancePaymentId: balancePaymentId,
             ethMinerAddress: ethMinerAddress,
             amount:amount,
             last_broadcast_block: ethBlock, //block it was broadcasted at
             confirmed: paymentConfirmed //confirmed by the ethereum network
          }*/

          //these will be use used to make sure that all transactions get confirmed



          if(paymentConfirmed) return;

          //await this.redisInterface.storeRedisHashData('queued_replacement_payment',balancePaymentId)


        //  await this.redisInterface.storeRedisHashData('broadcasted_payment' ,balancePaymentId.toString(),JSON.stringify(broadcastedPaymentData) )

        //  await this.redisInterface.pushToRedisList(('broadcasted_payments'), JSON.stringify(broadcastedPaymentData)  )
        //  await this.redisInterface.pushToRedisList(('unconfirmed_broadcasted_payments'), JSON.stringify(broadcastedPaymentData)  )


          try{
            var txCount = await this.web3.eth.getTransactionCount(addressFrom);
            console.log('txCount',txCount)
           } catch(error) {  //here goes if someAsyncPromise() rejected}
            console.log(error);

             return error;    //this will result in a resolved promise.
           }


           var txData = this.web3.eth.abi.encodeFunctionCall({
                   name: 'transfer',
                   type: 'function',
                   inputs: [{
                       type: 'address',
                       name: 'to'
                   },{
                       type: 'uint256',
                       name: 'tokens'
                   }]
               }, [ethMinerAddress, amount]);


               var max_gas_cost = 404624;

               var estimatedGasCost = await transferMethod.estimateGas({gas: max_gas_cost, from:addressFrom, to: addressTo });
               console.log('estimatedGasCost',estimatedGasCost)




                   if( estimatedGasCost > max_gas_cost){
                     console.log("Gas estimate too high!  Something went wrong ")
                   }
                   if(!estimatedGasCost){
                     estimatedGasCost = 305830;
                     console.log("Gas estimate was undefined, setting it to 305830");
                   }


                   var force_revert = false;

                   if(force_revert)
                   {
                     txCount = 9999;
                   }

                   const txOptions = {
                     nonce: web3Utils.toHex(txCount),
                     gas: web3Utils.toHex(404624),
                     gasPrice: web3Utils.toHex(web3Utils.toWei(this.poolConfig.transferGasPriceWei.toString(), 'gwei') ),
                     value: 0,
                     to: addressTo,
                     from: addressFrom,
                     data: txData
                   }

                   var privateKey =  this.getPaymentAccount().privateKey;


                 return new Promise(function (result,error) {

                      this.sendSignedRawTransaction(this.web3,txOptions,addressFrom,privateKey, function(err, res) {
                         if (err){console.log("big error"); error(err);}
                         result(res)
                     })

                   }.bind(this));


     },


     async getBalanceTransferConfirmed(paymentId)
     {
        //check balance payment

        var balanceTransferJSON = await this.redisInterface.findHashInRedis('balance_transfer',paymentId);
        var balanceTransfer = JSON.parse(balanceTransferJSON)


        if(balanceTransferJSON == null || balanceTransfer.txHash == null)
        {
          return false;
        }else{

          //dont need to check receipt because we wait many blocks between broadcasts - enough time for the monitor to populate this data correctly
          return balanceTransfer.confirmed;

        }


     },


   async testMergeMintAccount(address, solution_number, challenge_digest, max_gas_cost, addressFrom, addressTo ){
    try{
      var mintMethod = this.mintHelperContract.methods.proxyMergeMint(solution_number,challenge_digest, [address]);
      var txData = this.web3.eth.abi.encodeFunctionCall({
              name: 'proxyMergeMint',
              type: 'function',
              inputs: [{ type: 'uint256', name: 'nonce' },{ type: 'bytes32', name: 'challenge_digest' }, {type:'address[]',name:'tokens'}]
          }, [solution_number, challenge_digest, [address] ]);
      var estimatedGasCost = await mintMethod.estimateGas({gas: max_gas_cost, from:addressFrom, to: addressTo });
      return true;
     }catch(error){
       return false;
     }

   },
   async getWorkingMergeMintAccounts(solution_number, challenge_digest, max_gas_cost, addressFrom, addressTo){
     var accounts = []
     for( var i = 0; i < this.mergeMintTokens.length; i++){
       if(await this.testMergeMintAccount(this.mergeMintTokens[i], solution_number, challenge_digest, max_gas_cost, addressFrom, addressTo )){
         accounts.push(this.mergeMintTokens[i]);
       }
     }
     console.log("ACCOUNTS:",accounts);
     return accounts;

   },

    // return tx_hash
    async submitMiningSolution(minerAddress,solution_number,challenge_digest,challenge_number,resending){

      var ret = {}
      ret['merge_mining_addresses'] = [];
      ret['tx_hash'] =null;

      var addressFrom = this.getMintingAccount().address;

      console.log( '\n' )
      console.log( '---Submitting solution for reward---')
      console.log( 'nonce ',solution_number )
      console.log( 'challenge_number ',challenge_number )
      console.log( 'challenge_digest ',challenge_digest )
      console.log( '\n' )





    try{
      var txCount = await this.web3.eth.getTransactionCount(addressFrom);
      console.log('txCount',txCount)
     } catch(error) {  //here goes if someAsyncPromise() rejected}
      console.log('error tx count',error);

       ret['tx_hash'] = error
       return ret;    //this will result in a resolved promise.
     }

    var useMergeMint = false; // as opposed to directly minting to the minting account
    var addressTo = this.mintHelperContract.options.address;
    var max_gas_cost = 404624;
    if(useMergeMint){

     var activeMergeMintTokens = await this.getWorkingMergeMintAccounts( solution_number, challenge_digest, max_gas_cost, addressFrom, addressTo);
     ret['merge_mining_addresses'] = activeMergeMintTokens
     var mintMethod = this.mintHelperContract.methods.proxyMergeMint(solution_number,challenge_digest, activeMergeMintTokens);

    try{
      var txData = this.web3.eth.abi.encodeFunctionCall({
              name: 'proxyMergeMint',
              type: 'function',
              inputs: [{ type: 'uint256', name: 'nonce' },{ type: 'bytes32', name: 'challenge_digest' }, {type:'address[]',name:'tokens'}]
          }, [solution_number, challenge_digest, activeMergeMintTokens ]);
     } catch(error) {  //here goes if someAsyncPromise() rejected}
      console.log('error here',error);
     }

     var addressTo = this.mintHelperContract.options.address;

    }else{
    console.log("not merge mint");
      //call contract directly
        var mintMethod = this.tokenContract.methods.mint(solution_number,challenge_digest);

console.log("SOLUTION IS", solution_number,challenge_digest);
		      var txData = this.web3.eth.abi.encodeFunctionCall({
              name: 'mint',
              inputs: [{
                  type: 'uint256',
                  name: 'nonce'
              },{
                  type: 'bytes32',
                  name: 'challenge_digest'
              }]
          }, [solution_number, challenge_digest]);
       var addressTo = this.tokenContract.options.address;
    }
      estimatedGasCost = 404624
      console.log("ready to send");
     



     if(!estimatedGasCost){
       estimatedGasCost = 305830;
       console.log("Gas estimate was undefined, setting it to 305830");
     }


      if( estimatedGasCost > max_gas_cost){
        console.log("Gas estimate too high!  Something went wrong ")
        return ret;
      }

      var gas = await this.web3.eth.getGasPrice()*1.1;///2.0
      gas = Math.min(gas,90000000000)
      gas = gas.toFixed(0)
      var gas_hex = web3Utils.toHex(web3Utils.toWei(gas.toString(), 'wei'));



      const txOptions = {
        nonce: web3Utils.toHex(txCount),
        gas: web3Utils.toHex(estimatedGasCost),
        gasPrice:gas_hex,// web3Utils.toHex(web3Utils.toWei(this.poolConfig.solutionGasPriceWei.toString(), 'gwei') ),
        value: 0,
        to: addressTo,
        from: addressFrom,
        data: txData
      }

      var privateKey =  this.getMintingAccount().privateKey;

      ret['tx_hash'] = await  new Promise(function (result,error) {

         this.sendSignedRawTransaction(this.web3,txOptions,addressFrom,privateKey, function(err, res) {
          if (err) error(err)
            result(res)
        })

      }.bind(this));

      return ret;

    },




    async sendSignedRawTransaction(web3,txOptions,addressFrom,private_key,callback) {

      var privKey = this.truncate0xFromString( private_key )

      const privateKey = new Buffer( privKey, 'hex')
      const transaction = new Tx(txOptions)


      transaction.sign(privateKey)


      const serializedTx = transaction.serialize().toString('hex')

        try
        {
          var result =  web3.eth.sendSignedTransaction('0x' + serializedTx, callback)
        }catch(e)
        {
          console.log('error fail send signed',e);
        }
    },



       async requestCurrentChallengeNumber()
       {


         var self = this ;
         var result =  new Promise(function (fulfilled,error) {

           self.tokenContract.methods.getChallengeNumber().call(function(err, result){
              if(err){error(err);return;}

              fulfilled(result)

            });
          });



         return result;
       },



     truncate0xFromString(s)
    {
      if(s.startsWith('0x')){
        return s.substring(2);
      }
      return s;
    },

     getMintingAccount()
     {
       return this.accountConfig.minting;
     },

     getPaymentAccount()
     {
       return this.accountConfig.payment;
     }


}
