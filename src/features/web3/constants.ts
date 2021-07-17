import {LOCAL_CHAIN_ID} from '../../envVars'

export enum ChainId {
  Mainnet = 1,
  Ropsten = 3,
  Rinkeby = 4,
  Goerli = 5,
  Kovan = 42,
  BSC = 56,
  BSCTest = 97,
  Local = LOCAL_CHAIN_ID,
}
