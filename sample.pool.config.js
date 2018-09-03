
var poolconfig = {
  minimumShareDifficulty: 105,
  solutionGasPriceWei: 10, // not used - TODO REMOVE 
  transferGasPriceWei: 6, // not used - TODO REMOVE 
  poolTokenFee: 15,
  minBalanceForTransfer: 1500000000,
  mergeMintTokens: ['0x33d99efc0c3cc4f93da6931ec2cccf19ca874b6d', '0x291de53a16b76dfe28551fd3335225f506db8b82'],
  populationLimit: 100, // not used - TODO REMOVE 
  web3provider: "http://127.0.0.1:8545"
}


exports.config = poolconfig;
