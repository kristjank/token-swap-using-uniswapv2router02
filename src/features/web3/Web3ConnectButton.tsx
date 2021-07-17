import React, {useCallback, useMemo} from 'react'

import {useWeb3React} from '@web3-react/core'
import {Web3Provider} from '@ethersproject/providers'
import {InjectedConnector} from '@web3-react/injected-connector'
import {ChainId} from './constants'

import {useAppSelector} from '../../app/hooks'
import {selectTokenSwap} from '../tokenSwap/slice'

import classNames from 'classnames'
import styles from './web3.module.scss'

import spinner from '../../spinner-s.gif'

type Web3ConnectButtonProps = {
  className?: string
}

// The button that triggers the MetaMask window to prompt the user to connect with the app,
// or displays the connected account, or the number of pending transactions.
const Web3ConnectButton: React.FC<Web3ConnectButtonProps> = ({className}) => {
  const {account, activate, active} = useWeb3React<Web3Provider>()
  const {transactions} = useAppSelector(selectTokenSwap)

  const injectedConnector = useMemo(() => {
    const supportedChainIds = Object.values(ChainId)
      .map(Number)
      .filter((v) => !isNaN(v))
    return new InjectedConnector({supportedChainIds})
  }, [])

  const onClick = useCallback(() => {
    activate(injectedConnector)
  }, [activate, injectedConnector])

  let buttonContent: React.ReactNode
  if (transactions.length) {
    buttonContent = (
      <>
        <img src={spinner} className={styles.buttonSpinner} />
        {`${transactions.length} pending`}
      </>
    )
  } else {
    buttonContent = active ? account : 'Connect'
  }

  return (
    <button onClick={onClick} className={classNames('button', styles.web3connectButton, className)}>
      <span className={styles.buttonCaption}>{buttonContent}</span>
    </button>
  )
}

export default Web3ConnectButton
