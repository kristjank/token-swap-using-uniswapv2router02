import dotenv from 'dotenv'
import invariant from 'tiny-invariant'
import {isNode} from 'browser-or-node'

// If a file named .env containing variables prefixed with REACT_APP_ exists in the project's
// root, create-react-app injects those variables into an object named process.env which is
// **available in the browser**. We want those same variables to be available when running with
// Node (for Hardhat), therefore they are loaded using dotenv.

if (isNode) {
  dotenv.config()
}

const PREFIX='REACT_APP_'

const getEnv: (unprefixedKey: string) => string = (unprefixedKey) => {
  const key = PREFIX + unprefixedKey
  const value: string | undefined = process.env[key]
  invariant(value !== undefined, `env variable undefined: '${PREFIX}${unprefixedKey}'`)
  return value
}

export const JSON_RPC_URL = getEnv('JSON_RPC_URL')
export const LOCAL_CHAIN_ID: number = Number(getEnv('LOCAL_CHAIN_ID'))
export const FORKING_BLOCK_NUMBER: number = Number(getEnv('FORKING_BLOCK_NUMBER'))
export const INITIAL_BALANCE_ETHER = getEnv('INITIAL_BALANCE_ETHER')
