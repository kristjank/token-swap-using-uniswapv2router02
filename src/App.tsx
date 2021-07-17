import React, {useCallback, useEffect} from 'react'
import {useAppSelector, useAppDispatch} from './app/hooks'

import {useWeb3React} from '@web3-react/core'
import Web3ConnectButton from './features/web3/Web3ConnectButton'
import TokenSwapForm from './features/tokenSwap/TokenSwapForm'
import ReactModal from 'react-modal'

import {getTopPairs, selectUniswapSubgraph} from './features/uniswapSubgraph/slice'

import {LOCAL_CHAIN_ID} from './envVars'

import styles from './App.module.scss'

function App() {
  const dispatch = useAppDispatch()
  const {loading, error, pairs, tokens} = useAppSelector(selectUniswapSubgraph)

  const {chainId} = useWeb3React()

  useEffect(() => {
    dispatch(getTopPairs())
  }, [dispatch])

  const onRequestClose = useCallback(() => {}, [])

  return (
    <>
      <div className={styles.appBackground}>
        <div className={styles.appContent}>
          <div>
            <Web3ConnectButton className={styles.web3connectButton} />
          </div>
          <div className={styles.mainContent}>
            {loading ? (
              <p>Loading...</p>
            ) : error ? (
              <p>{error}</p>
            ) : (
              <TokenSwapForm pairs={pairs} tokens={tokens} />
            )}
          </div>
        </div>
      </div>
      {
        // Because it's possible to execute swaps on mainnet, block the app unless we are
        // connected with a local node.
      }
      <ReactModal
        isOpen={!!chainId && chainId !== LOCAL_CHAIN_ID}
        onRequestClose={onRequestClose}
        className={styles.cautionModalContent}>
        <p>
          For safety reasons, this app requires the Web3 provider to be connected with a chain ID of
          {LOCAL_CHAIN_ID}.
        </p>
      </ReactModal>
    </>
  )
}

export default App
