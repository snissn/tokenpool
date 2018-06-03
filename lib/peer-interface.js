
 //var redis = require("redis");
   var jayson = require('jayson');

   var web3utils =  require('web3-utils');

   var peerUtils = require('./peer-utils')

  // var redisClient;

  const UPDATE_VAR_DIFF_PERIOD = 30 * 1000; //30 seconds


  //const UPDATE_HASH_RATE_PERIOD = 4 * 60  * 1000;

  const SOLUTION_FINDING_BONUS = 10.0;
  var varDiffPeriodCount = 0;
  var PROCESS_DIFFICULTY = false; // false means vardiff

module.exports =  {


  async init( web3, accountConfig, poolConfig , redisInterface, tokenInterface ,pool_env)
  {
    this.pool_env = pool_env;
    this.web3=web3;
    this.accountConfig =accountConfig;
    this.poolConfig=poolConfig;

    this.redisInterface=redisInterface;
    this.tokenInterface=tokenInterface;


    if(this.poolConfig.poolTokenFee == null)
    {
      console.log('Please set a poolTokenFee (% of tokens as a pool fee)')
      exit()
      return;
    }



  },

  async listenForJSONRPC(port)
  {

        this.initJSONRPCServer(port);
  },

  async update()
  {


    var self = this;
  //  setInterval( function(){ self.monitorMinedSolutions()  } , 2*1000 )

    setTimeout(function(){self.processQueuedShares()},0)

    setTimeout(function(){self.monitorMinedSolutions()},0)




    //Error
    setTimeout(function(){self.monitorMinedPayments()},0)

     setTimeout(function(){self.updateVariableDifficultyPeriod()},0)

     setTimeout(function(){self.cleanRedisData()},0)
  },



   getPoolMinimumShareDifficulty()
   {
     return this.poolConfig.minimumShareDifficulty;
   },

   async getMinerVarDiff(minerEthAddress)
   {
     if(PROCESS_DIFFICULTY){return PROCESS_DIFFICULTY;}
     if( minerEthAddress == null ||  typeof minerEthAddress == 'undefined' || !web3utils.isAddress(minerEthAddress))
     {
       var poolMinDiff = this.getPoolMinimumShareDifficulty();
       return  poolMinDiff;
     }

     var minerData = await this.loadMinerDataFromRedis(minerEthAddress)

     var varDiff = minerData.varDiff;

     if(varDiff < this.getPoolMinimumShareDifficulty())
     {
       varDiff = this.getPoolMinimumShareDifficulty();
     }

     return varDiff;
   },

   getPoolMinimumShareTarget(diff) //compute me
   {
     if(diff == null)
     {
       diff =   this.getPoolMinimumShareDifficulty()
     }
     return this.getTargetFromDifficulty(diff);
   },


   getTargetFromDifficulty(difficulty)
   {
     if(this.pool_env == "test")
     {
       var max_target = web3utils.toBN( 2 ).pow( web3utils.toBN( 244 ) ) ;
     }else{
       var max_target = web3utils.toBN( 2 ).pow( web3utils.toBN( 234 ) ) ;
     }

     var current_target = max_target.div( web3utils.toBN( difficulty) );

     return current_target ;
   },


   /*
    This is the gatekeeper for solution submits
   */
   async handlePeerShareSubmit(nonce,minerEthAddress,challengeNumber,digest,difficulty)
   {



     //console.log('\n')
     //console.log('---- received peer share submit -----')
     //console.log('nonce',nonce)
     //console.log('challengeNumber',challengeNumber)
     //console.log('minerEthAddress',minerEthAddress)
     //console.log('digest',digest)
     //console.log('difficulty',difficulty)
     //console.log('\n')

     if( difficulty == null  ) return ;
     if( nonce == null  ) return ;
     if( minerEthAddress == null  ) return ;
     if( challengeNumber == null  ) return ;
     if( digest == null  ) return ;


     var poolEthAddress = this.getMintingAccount().address;


     var poolChallengeNumber = await this.tokenInterface.getPoolChallengeNumber();
     var computed_digest =  web3utils.soliditySha3( poolChallengeNumber , poolEthAddress, nonce )

     var digestBytes32 = web3utils.hexToBytes(computed_digest)
     var digestBigNumber = web3utils.toBN(computed_digest)


     var minShareTarget = web3utils.toBN(this.getPoolMinimumShareTarget() ) ;
     var miningTarget = web3utils.toBN(await this.tokenInterface.getPoolDifficultyTarget() ) ;

     var claimedTarget = this.getTargetFromDifficulty( difficulty )



     var varDiff = await this.getMinerVarDiff(minerEthAddress);

     var usingCustomDifficulty = (difficulty != varDiff);

     //console.log( 'computed_digest',computed_digest )
     //console.log( 'digest',digest )
     //console.log( 'digestBigNumber',digestBigNumber )

      //console.log( 'miningTarget',miningTarget )


        //console.log( 'claimedTarget',claimedTarget )
        //console.log( 'minShareTarget',minShareTarget )



    var minShareDifficulty = this.getPoolMinimumShareDifficulty()  ;


    if(computed_digest === digest &&
       difficulty >= minShareDifficulty &&
       digestBigNumber.lt(claimedTarget)  ){

        var shareIsASolution = digestBigNumber.lt(miningTarget)

        return await this.handleValidShare( nonce,minerEthAddress,digest,difficulty, shareIsASolution, usingCustomDifficulty );

     }else{
       //console.log('invalid share digest')

       var ethBlock = await this.redisInterface.getEthBlockNumber()

       var shareData =  {
         block: ethBlock,
         nonce: nonce,
         miner: minerEthAddress,
         difficulty: difficulty,
         time: peerUtils.getUnixTimeNow()
        };

       //await this.redisInterface.storeRedisHashData("invalid_share", digest , JSON.stringify(shareData))
       await this.redisInterface.pushToRedisList("miner_invalid_share:"+minerEthAddress.toString(),  JSON.stringify(shareData))



       return {success: false, message: "This share digest is invalid"};

     }

   },



   async  handleValidShare( nonce,minerEthAddress,digest,difficulty, shareIsASolution, usingCustomDifficulty )
   {
      //console.log('handle valid share ')
      var existingShare = await this.redisInterface.findHashInRedis("submitted_share", digest );

        //make sure we have never gotten this digest before (redis )
      if(existingShare == null)
      {
        //console.log('handle valid new share ')
        var ethBlock = await this.redisInterface.getEthBlockNumber()


        var minerData = await this.loadMinerDataFromRedis(minerEthAddress)

         minerData.usingCustomDifficulty = usingCustomDifficulty;

         await this.saveMinerDataToRedis(minerEthAddress,minerData)

        if(minerData.lastSubmittedSolutionTime != null)
        {
            var timeToFindShare = (peerUtils.getUnixTimeNow() - minerData.lastSubmittedSolutionTime);
        }else{
           //make sure we check for this later
            var timeToFindShare = 0;
        }



        var shareData=  {
          block: ethBlock,
          nonce: nonce,
          miner: minerEthAddress,
          difficulty: difficulty,
          isSolution: shareIsASolution,
          hashRateEstimate: this.getEstimatedShareHashrate(difficulty,timeToFindShare),
          time: peerUtils.getUnixTimeNow(),
          timeToFind: timeToFindShare  //helps estimate hashrate- look at recent shares
        };

        //make sure this is threadsafe
        await this.redisInterface.storeRedisHashData("submitted_share", digest , JSON.stringify(shareData))
        await this.redisInterface.pushToRedisList("miner_submitted_share:"+minerEthAddress.toString(),  JSON.stringify(shareData))

        await this.redisInterface.pushToRedisList("submitted_shares_list", JSON.stringify(shareData))

        if(shareIsASolution)
        {
          await this.redisInterface.pushToRedisList("submitted_solutions_list", JSON.stringify(shareData))
        }

        //redisClient.hset("submitted_share", digest , JSON.stringify(shareData), redis.print);

        var shareCredits =  await this.getShareCreditsFromDifficulty( difficulty,shareIsASolution )

        await this.awardShareCredits( minerEthAddress, shareCredits )

        //GIANT ISSUE IF AWAIT IS MISSING
        var challengeNumber = await this.tokenInterface.getPoolChallengeNumber();

        if( shareIsASolution )
        {
            console.log('share is a solution! ')
          this.tokenInterface.queueMiningSolution( nonce,minerEthAddress,digest,challengeNumber );
        }else{
            //console.log('share is not a solution! ')
        }

        return {success: true, message: "New share credited successfully"}

      }else{
        return {success: false, message: "This share digest was already received"}
      }

   },




   //also update hashrate
   async updateVariableDifficultyPeriod()
   {

     var self = this ;


           var minerList =  await this.getMinerList()


           for(i in minerList) //reward each miner
           {
             var minerAddress = minerList[i];

             var minerData = await this.getMinerData(minerAddress)

             minerData.hashRate = await this.estimateMinerHashrate(minerAddress )
             await this.saveMinerDataToRedis(minerAddress,minerData);
            }

          varDiffPeriodCount++;

        //  setTimeout(function(){self.updateVariableDifficultyPeriod()},4000  )///perform after booting
         setTimeout(function(){self.updateVariableDifficultyPeriod()},UPDATE_VAR_DIFF_PERIOD  )  // 1 minute
   },

   //TimeToSolveBlock (seconds) = difficulty * 2^22 / hashrate (hashes per second)


   //hashrate = (difficulty * 2^22) / timeToSolveABlock seconds)
   getEstimatedShareHashrate(difficulty, timeToFindSeconds )
   {
     if(timeToFindSeconds!= null && timeToFindSeconds>0)
     {

        var hashrate = web3utils.toBN(difficulty).mul( web3utils.toBN(2).pow(  web3utils.toBN(22) )).div( web3utils.toBN( timeToFindSeconds ) )

        return hashrate.toNumber(); //hashes per second

      }else{
        return 0;
      }
   },

   async estimateMinerHashrate(minerAddress)
   {
      try {

        var submitted_shares =  await this.redisInterface.getParsedElementsOfListInRedis(('miner_submitted_share:'+minerAddress.toString()), 20);

        if(submitted_shares == null || submitted_shares.length < 1)
        {
          return 0;
        }

        var totalDiff = 0;
        var CUTOFF_MINUTES = 30;
        var cutoff = peerUtils.getUnixTimeNow() - (CUTOFF_MINUTES * 60);

        // the most recent share seems to be at the front of the list
        var recentShareCount = 0;
        while (recentShareCount < submitted_shares.length && submitted_shares[recentShareCount].time > cutoff) {
          if(isNaN(submitted_shares[recentShareCount].difficulty)){
            continue;
          }
          totalDiff += submitted_shares[recentShareCount].difficulty;
          recentShareCount++;
        }

        if (isNaN(totalDiff) || recentShareCount == 0)
        {
          return 0;
        }

        var seconds = submitted_shares[0].time - submitted_shares[recentShareCount - 1].time;
        if (seconds == 0)
        {
          return 0;
        }
        var hashrate = this.getEstimatedShareHashrate( totalDiff, seconds );
        return hashrate.toString();

      } catch(err)
      {
        console.log('Error in peer-interface::estimateMinerHashrate: ',err);
        return 0;
      }
  },


  //timeToFind
  async getAverageSolutionTime(minerAddress)
  {
    var submitted_shares =  await this.redisInterface.getRecentElementsOfListInRedis(('miner_submitted_share:'+minerAddress.toString()), 3)

    var sharesCount = 0;

    if(submitted_shares == null || submitted_shares.length < 1)
    {
      return null;
    }


    var summedFindingTime  = 0;

    for (var i=0;i<submitted_shares.length;i++)
    {
      var share = submitted_shares[i];

      var findingTime = parseInt(share.timeToFind);

      if(!isNaN(findingTime) && findingTime> 0 && findingTime != null)
      {
          summedFindingTime += findingTime;
            sharesCount++;
       }
    }

    if(sharesCount <= 0)
    {
      return null;
    }


    var timeToFind = Math.floor(summedFindingTime / sharesCount);
    return timeToFind;
  },

   //we expect a solution per minute ??
   async getUpdatedVarDiffForMiner(minerData,minerAddress)
   {
      var minerVarDiff = minerData.varDiff;
      var poolMinDiff = this.getPoolMinimumShareDifficulty();
      var avgFindingTime = await this.getAverageSolutionTime(minerAddress);

      //dont modify if using custom
      if(minerData.usingCustomDifficulty)
      {
        return minerVarDiff;
      }

      minerData.avgFindingTime = avgFindingTime;

      var expectedFindingTime = 60;//seconds



      if( minerData.validSubmittedSolutionsCount > 0 && avgFindingTime!= null ){
           if( avgFindingTime < expectedFindingTime * 0.9 ){
                minerVarDiff = Math.ceil(minerVarDiff * 1.2 ); //harder
           }else if( avgFindingTime > expectedFindingTime * 1.1 ){
                minerVarDiff = Math.ceil(minerVarDiff / 1.2 ); //easier
           }
      }

      return 65536;
      if(PROCESS_DIFFICULTY){
        return PROCESS_DIFFICULTY;
      }


      if( minerVarDiff <  poolMinDiff ){
           minerVarDiff = poolMinDiff;
      }

      var MAX_VARDIFF = 12*1024;
      var MIN_DIFF = 1024;

      if( minerVarDiff > MAX_VARDIFF ){
           minerVarDiff = MAX_VARDIFF;
      }
      if(minerVarDiff < MIN_DIFF){
        minerVarDiff = MIN_DIFF;
      }
if(minerAddress.toString().toLowerCase() == '0xa2ed64126ddb337b41cfb988c9b0fecd0541cd39'){
	minerVarDiff = 6*1024;
}
if(minerAddress.toString() == '0xcEc9Fb601cD6398B382971027FCEC7818a25A48B'){
	minerVarDiff = 6*1024;
}
if(minerAddress.toString() == '0xe935e333190CDe0661092fF97072cC05Cca79da5'){
	minerVarDiff = 8*1024;
}
if(minerAddress.toString() == '0xdE4c8857A3719127c8f8A771Dbfc4D3Aea2c58dc'){
	minerVarDiff = 6*1024;
}
if(minerAddress.toString() == '0xcEc9Fb601cD6398B382971027FCEC7818a25A48B'){
	minerVarDiff = 6*1024;
}
if(minerAddress.toString() == '0x14fCfD34F3C88289EfDE9F6cE3F39daDe2Ca91BD'){
	minerVarDiff = 6*1024;
}
if(minerAddress.toString() == '0x53a65913ed38d4537fb928bfcff03df00b8b26fd'){
	minerVarDiff = 6*1024;
}
if(minerAddress.toString() == '0x2D7fb51a4FD377c119083C6dbEeC6215F752487B'){
	minerVarDiff = 11400;
}
if(minerAddress.toString() == '0x2c5b458c5823AbDeD805C5A991eA373A722E87Bf'){
	minerVarDiff = 16*1024;
}
if(minerAddress.toString() == '0xec354cdb058b7Eb9c5c5B86A045c8BFeEa5B8ffC'){
	minerVarDiff = 16*1024;
}
if(minerAddress.toString() == '0xC8CF14D29977902d78506E533B5967db98C38575'){
	minerVarDiff = 16*1024;
}

if(minerAddress.toString() == '0xF13e2680a930aE3a640188afe0F94aFCeBe7023b'){
	minerVarDiff = 1024;
}
if(minerAddress.toString() == '0xAc98eb31f68eE6777C1BD29E6fCacFa9DC451Ca3'){
	minerVarDiff = 64*1024;
}
if(minerAddress.toString() == '0xb76c8ee9b753c44522d1c25d785d81b8b3913533'){
	minerVarDiff = 7*1024;
}
if(minerAddress.toString() == '0x3584EfbB3daB1D249c635e53305b1FBA77C723A5'){
	minerVarDiff = 8*1024;
}
if(minerAddress.toString() == '0xe57A18783640c9fA3c5e8E4d4b4443E2024A7ff9'){
	minerVarDiff = 16*1024;
}
if(minerAddress.toString() == '0x64951D89361e898e8B12100E181369AC9F1840E9'){
	minerVarDiff = 5*1024;
}
if(minerAddress.toString() == '0xA804e933301AA2C919D3a9834082Cddda877C205'){
	minerVarDiff = 205;
}
if(minerAddress.toString() == '0x046be9572F0058F47C8618B17EcA63061dFA415c'){
	minerVarDiff = 32*1024;
}
if(minerAddress.toString() == '0x167e733de0861f0d61b179d3d1891e6b90587732'){
	minerVarDiff = 4*1024;
}
if(minerAddress.toString() == '0x7C4AADEC857E13E4a5642B4041a2f36274fFE8ce'){
	minerVarDiff = 4*1024;
}
if(minerAddress.toString() == '0x7E1187fE78e404F1Bc531a9776Ae452EfDb6DBfA'){
	minerVarDiff = 8*1024;
}
if(minerAddress.toString() == '0xfcc6bf3369077e22a90e05ad567744bf5109e4d4'){
	minerVarDiff = 16*1024;
}
if(minerAddress.toString() == '0x171D02d216c038cbA86276B2824Cc79D34Efd26B'){
	minerVarDiff = 8*1024;
}
if(minerAddress.toString() == '0x2Ab9044f2f4938Dae788A67Dc08998855Ef434b3'){
	minerVarDiff = 2*1024;
}
if(minerAddress.toString() == '0x00FCae4Bd855E44948445e35888E828A559e64eC'){
	minerVarDiff = 4*1024;
}

if(minerAddress.toString() == '0xF40c0F78af28d1A7626E8c1F2Baf37951aA2DbDa'){
	minerVarDiff = 4*8*1024;
}
if(minerAddress.toString() == '0x9F03Eb9d6eD5467DDFDE617d104dcC26AE8B1590'){
	minerVarDiff = 4*1024;
}
if(minerAddress.toString() == '0xbd4Ae0dc3c0FA45e0119d3C108acDe1DaD5E7825'){
	minerVarDiff = 4*1024;
}

if(minerAddress.toString() == '0x8c31E53563d9F5c1D74541232d5F85Ee4d5948A3'){
	minerVarDiff = 12*1024;
}
if(minerAddress.toString() == '0x38389B9245EE21b3b622188EAd25cDAAC42924aB'){
	minerVarDiff = 24*1024;
}
if(minerAddress.toString() == '0x00FCae4Bd855E44948445e35888E828A559e64eC'){
	minerVarDiff = 24*1024;
}
if(minerAddress.toString() == '0xfa4d3B1183B6a1453a99CB5C60f9f28De12aaE7D'){
	minerVarDiff = 24*1024;
}
if(minerAddress.toString() == '0xF13e2680a930aE3a640188afe0F94aFCeBe7023b'){
	minerVarDiff = 4*1024;
}


      return minerVarDiff;
   },

   async processQueuedShares()
   {
       var self = this;

     var shareDataJSON = await this.redisInterface.popFromRedisList("queued_shares_list")

     var shareData = JSON.parse(shareDataJSON)

     if(typeof shareData != 'undefined' && shareData != null)
     {
       try{
         if(shareData.difficulty !=65536){
           console.error(shareData.minerEthAddress, shareData.difficulty);
         }
         var response =  await self.handlePeerShareSubmit(shareData.nonce,shareData.minerEthAddress,shareData.challengeNumber,shareData.digest,65536);
         //var response =  await self.handlePeerShareSubmit(shareData.nonce,shareData.minerEthAddress,shareData.challengeNumber,shareData.digest,shareData.difficulty );
         }catch(err)
         {
           console.log('handle share error: ',err);
         }
       }
       setTimeout(function(){self.processQueuedShares()},0)

   },

   async cleanRedisData()
   {
     return;
     var self = this;


     //loop through each miner
     var minerList =  await self.getMinerList()


     for(i in minerList)
     {
       var minerEthAddress = minerList[i];

       console.log('remove extra data for ',minerEthAddress)
       await this.redisInterface.removeFromRedisListToLimit("miner_invalid_share:"+minerEthAddress.toString(),50);
       await this.redisInterface.removeFromRedisListToLimit("submitted_shares_list",50);
       await this.redisInterface.removeFromRedisListToLimit("miner_submitted_share:"+minerEthAddress.toString(),400);
     }


     var currentEthBlock = await this.redisInterface.getEthBlockNumber();

     var DIGESTS_LIFETIME_BLOCKS = 1000;


     var submittedSharesKeys = await this.redisInterface.getResultsOfKeyInRedis("submitted_share" );

     for(i in submittedSharesKeys)
     {
       var digest = submittedSharesKeys[i];
       var submittedShareDataJSON = await this.redisInterface.findHashInRedis("submitted_share", digest)
       var submittedShareData =JSON.parse(submittedShareDataJSON)

       if( submittedShareData.block < (currentEthBlock-DIGESTS_LIFETIME_BLOCKS) )
       {
         console.log('deleting submittedShareData',submittedShareData)

         await this.redisInterface.deleteHashInRedis("submitted_share", digest)
       }
     }




     setTimeout(function(){self.cleanRedisData()},60 * 1000*10)
   },

   async monitorMinedSolutions()
   {

     var self = this ;

    try {
     console.log('monitor mined solutions ')
     var solution_txes = await this.redisInterface.getResultsOfKeyInRedis('unconfirmed_submitted_solution_tx')

     if( solution_txes != null && solution_txes.length > 0)
     {
        var response = await this.checkMinedSolutions( solution_txes )
     }
    }catch(e)
    {
    console.log('error',e)
     }

      setTimeout(function(){self.monitorMinedSolutions()},4000)

   },


   // resendUnbroadcastedPayments()
   async monitorMinedPayments()
   {

     var self = this ;

    try {


      /*
      await this.redisInterface.storeRedisHashData('broadcasted_payment' ,balancePaymentId.toString(),JSON.stringify(broadcastedPaymentData) )
      await this.redisInterface.pushToRedisList(('broadcasted_payments'), JSON.stringify(broadcastedPaymentData)  )
      await this.redisInterface.pushToRedisList(('unconfirmed_broadcasted_payments'), JSON.stringify(broadcastedPaymentData)  )
      */

         console.log('monitor mined payments ')
         var balance_xfers = await this.redisInterface.getResultsOfKeyInRedis('balance_payment')



         if( balance_xfers != null && balance_xfers.length > 0)
         {
            await this.checkMinedPayments( balance_xfers )
         }


    }catch(e){
    console.log('error',e)
     }

      setTimeout(function(){self.monitorMinedPayments()},4000)

   },



      async requestTransactionReceipt(tx_hash)
      {
          try{
           var receipt = await this.web3.eth.getTransactionReceipt(tx_hash);
         }catch(err)
         {
           console.error("could not find receipt ", tx_hash )
         }
           return receipt;
      },

   //checks each to see if they have been mined
   async checkMinedSolutions(solution_txes)
   {
     for(i in solution_txes)
     {
       var tx_hash = solution_txes[i];

       var txDataJSON = await this.redisInterface.findHashInRedis('unconfirmed_submitted_solution_tx',tx_hash);
       var transactionData = JSON.parse(txDataJSON)


       if( transactionData.mined == false )
       {
         var liveTransactionReceipt = await this.requestTransactionReceipt(tx_hash)

         if(liveTransactionReceipt != null )
         {
           //console.log('got receipt',liveTransactionReceipt )
               transactionData.mined = true;

               //var transaction_succeeded =  (web3utils.hexToNumber( liveTransactionReceipt.status) == 1 )
               var transaction_succeeded =  liveTransactionReceipt.status === true || (web3utils.hexToNumber( liveTransactionReceipt.status) == 1 );

               if( transaction_succeeded )
               {
                 transactionData.succeeded = true;
                 //console.log('transaction was mined and succeeded',tx_hash)
               }else {
                 //console.log('transaction was mined and failed',tx_hash)
               }

               await this.redisInterface.deleteHashInRedis('unconfirmed_submitted_solution_tx',tx_hash)
               //save as confirmed
               await this.saveSubmittedSolutionTransactionData(tx_hash,transactionData)
         }else{
           console.log('got null receipt',tx_hash)
         }
       }


       if(transactionData.mined == true && transactionData.succeeded == true && transactionData.rewarded == false )
       {
         console.log( 'found unrewarded successful transaction ! ' , tx_hash  )

          var success = await this.grantTokenBalanceRewardForTransaction( tx_hash,transactionData )

          transactionData.rewarded = true;

          await this.saveSubmittedSolutionTransactionData(tx_hash,transactionData)
       }


     }

   },



/*
  For every balance payment, make sure there is a good transfer payment

*/
   async checkMinedPayments(balance_xfers)
   {
      //console.log('check mined payments')

     var currentEthBlock = await this.redisInterface.getEthBlockNumber();

     var REBROADCAST_WAIT_BLOCKS = 500;

     for(i in balance_xfers)
     {
       var paymentId = balance_xfers[i];


      var paymentDataJSON = await this.redisInterface.findHashInRedis('balance_payment',paymentId);
      var paymentData = JSON.parse(paymentDataJSON)

      //who to pay and how much to pay them
      var tokenAmount = paymentData.previousTokenBalance;
      var minerAddress = paymentData.minerAddress;


      var txDataJSON = await this.redisInterface.findHashInRedis('payment_tx',paymentId);
      var txData = JSON.parse(txDataJSON)


      var balanceTransferJSON = await this.redisInterface.findHashInRedis('balance_transfer',paymentId);
      var transferData = JSON.parse(balanceTransferJSON)

      //  Too confusing !! too many data pieces are being examined


      //if a tx exists and was confirmed, we don't need to touch it
      //is this correct !?
      if(transferData != null && transferData.confirmed == true )
      {
        continue;
      }



      //if a tx doesn't exist or it does but is unconfirmed and old, we need to pay it
      if(txDataJSON == null || (txData.last_broadcast_block < (currentEthBlock - REBROADCAST_WAIT_BLOCKS)) )
      {

        //make a payment_tx and set its block to a current one

        var broadcastedPaymentData = {
             balancePaymentId: paymentId,
             minerAddress: minerAddress,
             tokenAmount: tokenAmount,
             last_broadcast_block: currentEthBlock
          }

        await this.redisInterface.storeRedisHashData('payment_tx' ,paymentId.toString(),JSON.stringify(broadcastedPaymentData) )


        if(balanceTransferJSON == null || transferData.txHash == null || transferData.confirmed != true )
        {

          var transferData = {
            addressTo:  minerAddress,
            balancePaymentId: paymentId,
            tokenAmount: tokenAmount,
            txHash: null,
            block:currentEthBlock,
            confirmed: false
          }

          //I think this has a null amount


          //need to rebroadcast for sure
          await this.queueBalancePayment(transferData)

        }

      }


       //why doesnt this work !?
       if(transferData != null && transferData.txHash != null && transferData.confirmed != true)
        {
          //try to get receipt via txhash


          var txHash = transferData.txHash;


          console.log('inspecting unconfirmed balance transfer',txHash)
          if(!txHash){return;}

          var liveTransactionReceipt = await this.requestTransactionReceipt(txHash)

          if(liveTransactionReceipt != null )
          {
            //console.log('got receipt',liveTransactionReceipt )

            transferData.confirmed = true;//also called 'mined'

            var transaction_succeeded =  liveTransactionReceipt.status === true || (web3utils.hexToNumber( liveTransactionReceipt.status) == 1 );
            //var transaction_succeeded =  (web3utils.hexToNumber( liveTransactionReceipt.status) == 1 )

            if( transaction_succeeded )
            {
              transferData.succeeded = true;
              //console.log('transaction was mined and succeeded',txHash)
            }else {

              await this.queueBalancePayment(transferData)
              //console.log('transaction was mined and failed',txHash)
            }

            //await this.redisInterface.deleteHashInRedis('unconfirmed_broadcasted_payment',paymentId)

            //save balance_transfer as confirmed
            await this.redisInterface.storeRedisHashData('balance_transfer' ,paymentId,JSON.stringify(transferData) )

          }else{
            //console.log('got null balance transfer receipt',txHash)
          }

          //maybe rebroadcast if it failed


          //hdel this record so we dont keep checking it
          //save a new happy confirmed record

        }



       /*
       if(transactionData.mined == true && transactionData.succeeded == true && transactionData.rewarded == false )
       {
         console.log( 'found unrewarded successful transaction ! ' , tx_hash  )

          var success = await this.grantTokenBalanceRewardForTransaction( tx_hash,transactionData )

          transactionData.rewarded = true;

          await this.saveSubmittedSolutionTransactionData(tx_hash,transactionData)
       }
       */

     }

   },


   async queueBalancePayment(paymentData)
   {
     var balancePaymentId = paymentData.balancePaymentId;

    // var existingReplacementPayment = await this.redisInterface.findHashInRedis('queued_replacement_payment',balancePaymentId)

     var currentEthBlock = await this.redisInterface.getEthBlockNumber();



     //make sure only one replacement tx is being queued
  //   if( existingReplacementPayment == null   )
  //   {
        //paymentData.last_broadcast_block = currentEthBlock;
        await this.redisInterface.storeRedisHashData('queued_balance_payment' ,balancePaymentId ,JSON.stringify(paymentData) )
        //console.log('queue balance payment');


        //create a new queued transfer
        // if(this.pool_env == "staging")
        // {
            await this.tokenInterface.queueTokenTransfer(paymentData.addressTo, paymentData.tokenAmount, paymentData.balancePaymentId)
      //   }

//}


   },




     async saveSubmittedSolutionTransactionData(tx_hash,transactionData)
     {
        await this.redisInterface.storeRedisHashData('submitted_solution_tx',tx_hash,JSON.stringify(transactionData) )
        await this.redisInterface.pushToRedisList('submitted_solutions_list',JSON.stringify(transactionData) )

     },


   async loadStoredSubmittedSolutionTransaction(tx_hash)
   {
      var txDataJSON = await this.redisInterface.findHashInRedis('submitted_solution_tx',tx_hash);
      var txData = JSON.parse(txDataJSON)
      return txData
   },



   async grantTokenBalanceRewardForTransaction(tx_hash,transactionData)
   {
     var reward_amount = transactionData.token_quantity_rewarded;

     var fee_percent =  this.poolConfig.poolTokenFee / 100.0;  // 5

     if(fee_percent > 1.0)  fee_percent = 1.0
     if(fee_percent < 0) fee_percent = 0.0


     var reward_amount_for_miners = Math.floor( reward_amount - (reward_amount * fee_percent) );

     //console.log('granting',reward_amount)

     var total_shares = await this.getTotalMinerShares();

      var minerList =  await this.getMinerList()

      for(i in minerList) //reward each miner
      {
        var minerAddress = minerList[i];

         var minerData = await this.getMinerData(minerAddress)

         //console.log('minerData',minerData)

         var miner_shares = minerData.shareCredits;



         var miner_percent_share = parseFloat(miner_shares) / parseFloat( total_shares );

         if( isNaN(miner_percent_share) )
         {
           miner_percent_share = 0;
         }


         //console.log('miner_percent_share',miner_percent_share)  //nan

         var tokensOwed =  Math.floor( reward_amount_for_miners * miner_percent_share );  //down to 8 decimals

         //console.log('tokensOwed',tokensOwed)

         var  newTokenBalance = parseInt( minerData.tokenBalance );

         if( isNaN(newTokenBalance) )
         {
           newTokenBalance = 0;
         }

         // IS THIS WIPING TOKEN BALANCE IMPROPERLY ?


         //console.log('newTokenBalance',newTokenBalance)
         newTokenBalance += tokensOwed;

         minerData.tokenBalance = newTokenBalance;
         minerData.shareCredits = 0; //wipe old shares

         //console.log('tokenBalance', minerData.tokenBalance)

         await this.saveMinerDataToRedis(minerAddress,minerData)


      //   var minerShares = minerData.

      }


      //console.log('finished granting tokens owed ')


   },

   //need to know when one of our mining solutions SUCCEEDS
   // then we will start a new round and record tokens owed !
   checkTokenBalance()
   {



   },




  async  getShareCreditsFromDifficulty(difficulty,shareIsASolution)
   {

     var minShareDifficulty = this.getPoolMinimumShareDifficulty()  ;
     var miningDifficulty = parseFloat( await this.tokenInterface.getPoolDifficulty() ) ;

     if(shareIsASolution)//(difficulty >= miningDifficulty)
     {
       //if submitted a solution
      // return 10000;

      var amount = Math.floor( difficulty   ) ;
       //console.log('credit amt ', amount,minShareDifficulty,miningDifficulty )

       amount += SOLUTION_FINDING_BONUS;
       return amount;

     }else if(difficulty >= minShareDifficulty)
     {

       var amount = Math.floor(  difficulty    ) ;
       //console.log('credit amt ', amount,minShareDifficulty,miningDifficulty )
       return amount;
     }

     console.log('no shares for this solve!!',difficulty,minShareDifficulty)

     return 0;
   },


   async awardShareCredits( minerEthAddress, shareCredits )
   {

     //console.log('awarding shares : ' + shareCredits )
    var minerData = await this.loadMinerDataFromRedis(minerEthAddress)

    if( minerData.shareCredits == null || isNaN(minerData.shareCredits)) minerData.shareCredits = 0
    if( shareCredits == null || isNaN(shareCredits)) shareCredits = 0




     minerData.shareCredits += parseInt(shareCredits);
     minerData.validSubmittedSolutionsCount += 1;
     minerData.lastSubmittedSolutionTime = peerUtils.getUnixTimeNow();

     //console.log( 'miner data - award shares ', minerEthAddress, JSON.stringify(minerData))

     await this.saveMinerDataToRedis(minerEthAddress,minerData)
   },

   async saveMinerDataToRedis(minerEthAddress, minerData)
   {
     await this.redisInterface.storeRedisHashData("miner_data", minerEthAddress , JSON.stringify(minerData))

   },


   async loadMinerDataFromRedis(minerEthAddress)
   {
     var existingMinerDataJSON = await this.redisInterface.findHashInRedis("miner_data", minerEthAddress );

     if(existingMinerDataJSON == null)
     {
       existingMinerData = this.getDefaultMinerData();
     }else{
       existingMinerData = JSON.parse(existingMinerDataJSON)
     }

     return existingMinerData;
   },

   getDefaultMinerData(){
     return {
       shareCredits: 0,
       tokenBalance: 0, //what the pool owes
       tokensAwarded:0,
       varDiff: 1, //default
       validSubmittedSolutionsCount: 0
     }
   },


   async getTotalMinerHashrate()
   {
     var allMinerData = await this.getAllMinerData();


     var hashrateSum = 0;

     for(i in allMinerData)
     {
       var data = allMinerData[i].minerData

       var minerAddress = data.minerAddress;
       var minerHashrate = parseInt( data.hashRate );

        if(isNaN(minerHashrate)){
          minerHashrate = 0;
        }

       hashrateSum += minerHashrate;
     }

     //console.log('got miner total hashRate in KHs', hashrateSum)
     return hashrateSum / 1000;

   },

   async getTotalMinerShares()
   {
     var allMinerData = await this.getAllMinerData();



     var totalShares = 0;

     for(i in allMinerData)
     {
       var data = allMinerData[i].minerData

       var minerAddress = data.minerAddress;
       var minerShares = data.shareCredits;

       totalShares += minerShares;
     }

     console.log('got miner total shares', totalShares)
     return totalShares;

   },

   async getAllMinerData()
   {

     var minerList =  await this.getMinerList()

     var results = [];

     for(i in minerList)
     {
       var minerAddress = minerList[i]
       var minerData = await this.getMinerData(minerAddress)
       results.push({minerAddress: minerAddress, minerData: minerData})
     }

     return results;

   },

   async getMinerData(minerEthAddress)
   {

     var minerDataJSON = await this.redisInterface.findHashInRedis("miner_data", minerEthAddress );

     return JSON.parse(minerDataJSON) ;

   },

   async getMinerList( )
   {
       var minerData = await this.redisInterface.getResultsOfKeyInRedis("miner_data" );

       return minerData;

   },













  async initJSONRPCServer(port)
     {

       var self = this;

       if(port == 9000){
         PROCESS_DIFFICULTY = 4*1024;
       }else if(port == 9001){
         PROCESS_DIFFICULTY = 6*1024;
       }else if(port == 9002){
         PROCESS_DIFFICULTY = 8*1024;
       }else if(port == 9003){
         PROCESS_DIFFICULTY = 16*1024;
       }else if(port == 9004){
         PROCESS_DIFFICULTY = 2*1024;
       }else if(port == 9005){
         PROCESS_DIFFICULTY = 1024;
       }
       PROCESS_DIFFICULTY = 65536;
       //console.log("DIFF:",port, PROCESS_DIFFICULTY);




       console.log('listening on JSONRPC server localhost:', port)
         // create a server
         var server = jayson.server({
           ping: function(args, callback) {

               callback(null, 'pong');

           },

          /* join: function(args, callback) {


                console.log('miner joining pool')

            //   var minerEthAddress = args[0];

            //   callback(null, self.addMinerToPool().toString() );

          },*/

           getPoolEthAddress: function(args, callback) {

               callback(null, self.getMintingAccount().address.toString() );

           },

           getMinimumShareDifficulty: async function(args, callback) {

            var minerEthAddress = args[0];


            var varDiff = await self.getMinerVarDiff(minerEthAddress);


            callback(null, varDiff);


          },

          getMinimumShareTarget: async function(args, callback) {
            var minerEthAddress = args[0];

            var varDiff = await self.getMinerVarDiff(minerEthAddress);

            //always described in 'hex' to the cpp miner
            var minTargetBN = self.getPoolMinimumShareTarget( varDiff );

            //console.log('giving target ', minTargetBN , minTargetBN.toString(16) )
           callback(null,  minTargetBN.toString() );

         },
         getChallengeNumber: async function(args, callback) {

           var challenge_number = await self.redisInterface.loadRedisData('challengeNumber' )

           if(challenge_number!= null)
           {
             challenge_number = challenge_number.toString()
           }
          callback(null, challenge_number );

        },
        getAllMiningParameters: async function(args, callback) {
          /* format of parameter from client:
          args = {
            'clientEthAddress': minerEthAddress,
            // 'clientWorkerName': minerWorkerName,
            'poolEthAddress': poolEthAddress,
            'challengeNumber': poolChallengeNumber,
            'shareTarget': poolMinimumShareTarget,
            'shareDifficulty': poolMinimumShareDifficulty
          }; 

          Any values in the args parameter which have changed pool-side will 
          be included in the response object. Values that are the same are
          omitted. If keys are completely omitted from the args object they will
          also be omitted from the response. 

          Note: If 'shareTarget' or 'shareDifficulty' keys are requested, the
          `clientEthAddress' key must be included. Otherwise it may be omitted. */

          let response = {};

          /* pool eth address */
          if ("poolEthAddress" in args) {
            let address = self.getMintingAccount().address.toString();
            if(args.poolEthAddress != address) {
              response.poolEthAddress = address;
            }
          }

          /* challenge number */
          if ("challengeNumber" in args) {
            let challenge_number = await self.redisInterface.loadRedisData('challengeNumber');
            /* not 100% sure why this check is here, but it can't hurt to leave it */
            if(challenge_number!= null)
            {
              challenge_number = challenge_number.toString()
            }
            if(args.challengeNumber != challenge_number) {
              response.challengeNumber = challenge_number;
            }
          }

          /* difficulty */
          if ("shareDifficulty" in args) {
            let varDiff = await self.getMinerVarDiff(args.minerEthAddress);
            if(args.shareDifficulty != varDiff) {
              response.shareDifficulty = varDiff;
            }
          }

          /* share target */
          if ("shareTarget" in args) {
            let varDiff = await self.getMinerVarDiff(args.minerEthAddress);
            let share_target = self.getPoolMinimumShareTarget(varDiff).toString();
            if(args.shareTarget != share_target) {
              response.shareTarget = share_target;
            }          
          }

          callback(null, response);
        },



        submitShare: async function(args, callback) {

          var validJSONSubmit = true;

          var nonce = args[0];
          var minerEthAddress = args[1];
          var digest = args[2];
          var difficulty = args[3];
          var challenge_number = args[4]

          if(
            difficulty == null  ||
            nonce == null  ||
            minerEthAddress == null  ||
            challenge_number == null  ||
            digest == null
          ) {
            validJSONSubmit = false;
          }


          var minShareDifficulty = self.getPoolMinimumShareDifficulty()  ;
          if( difficulty <  minShareDifficulty)
          {
            validJSONSubmit = false;
          }


          var poolEthAddress = self.getMintingAccount().address;
          var poolChallengeNumber = await self.tokenInterface.getPoolChallengeNumber();
          var computed_digest =  web3utils.soliditySha3( poolChallengeNumber , poolEthAddress, nonce )

          var digestBigNumber = web3utils.toBN(digest);
          var claimedTarget = self.getTargetFromDifficulty( difficulty )

          if(computed_digest !== digest || digestBigNumber.gte(claimedTarget))
          {
            validJSONSubmit = false;
          }

          var ethBlock = await self.redisInterface.getEthBlockNumber();

          var shareData = {block: ethBlock ,nonce: nonce,minerEthAddress: minerEthAddress,challengeNumber: challenge_number,digest: digest,difficulty: difficulty};

          var response = await self.redisInterface.pushToRedisList("queued_shares_list", JSON.stringify(shareData));


          callback(null,  validJSONSubmit );

          },



           getMinerData: async function(args, callback) {

             var minerEthAddress = args[0];
             var minerData = null;

             if(web3utils.isAddress(minerEthAddress.toString()) ){
                 minerData = await self.getMinerData(minerEthAddress);
             }else{
               console.log('getMinerData error: not a valid address')
             }

             // console.log('meep',minerData)
            callback(null, JSON.stringify( minerData )  );

          },
          getAllMinerData: async function(args, callback) {

            var minerData = await self.getAllMinerData();


           callback(null, JSON.stringify( minerData )  );

         },

         });

         server.http().listen(port);

     },



        async getAllTransactionData()
        {

          var ethereumTransactionHashes = await this.redisInterface.getResultsOfKeyInRedis('active_transactions')

          var ethereumTransactions = [];

          for(i in ethereumTransactionHashes){
            var hash = ethereumTransactionHashes[i];
          //  console.log( 'hash',hash)

             var packetDataJSON = await this.redisInterface.findHashInRedis('active_transactions',hash);
             var packetData = JSON.parse(packetDataJSON)

             packetData.txHash = hash

            ethereumTransactions.push( packetData )
          }


          return ethereumTransactions;


        },


        async getPoolData()
        {
          return {
            tokenFee: this.poolConfig.poolTokenFee,
            mintingAddress: this.accountConfig.minting.address,
            paymentAddress: this.accountConfig.payment.address
          }
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
