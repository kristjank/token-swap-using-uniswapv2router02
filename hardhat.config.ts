/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import '@typechain/hardhat'
import '@nomiclabs/hardhat-waffle'

import {HardhatUserConfig} from 'hardhat/config'
import {ethers} from 'ethers'

import {FORKING_BLOCK_NUMBER, INITIAL_BALANCE_ETHER, JSON_RPC_URL, LOCAL_CHAIN_ID} from './src/envVars'

const initialBalanceEther = ethers.utils.parseEther(INITIAL_BALANCE_ETHER).toString()

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.6',
        settings: {
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: JSON_RPC_URL,
        blockNumber: FORKING_BLOCK_NUMBER,
      },
      chainId: LOCAL_CHAIN_ID,
      accounts: [
        {
          privateKey: '<YOUR_EXPORTED_PRIVATE_KEY>',
          balance: initialBalanceEther,
        },
      ],
      throwOnCallFailures: false,
      throwOnTransactionFailures: false,
    },
  },
  mocha: {
    bail: true,
    timeout: '600s',
  },
  typechain: {
    outDir: 'src/typechain',
    externalArtifacts: [
      'node_modules/@uniswap/v2-core/build/I*.json',
      'node_modules/@uniswap/v2-periphery/build/I*.json',
    ],
  },
}

export default config
