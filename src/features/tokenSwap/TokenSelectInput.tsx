import React, {useCallback, useState} from 'react'
import useSWR from 'swr'
import {useWeb3React} from '@web3-react/core'
import {BigNumber} from 'ethers'

import {Token} from '../../app/types'
import {TokenId} from '../../app/constants'

import {TokenSwapApi, formatMoney} from './api'
import TokenRequester from './TokenRequester'

import classNames from 'classnames'
import styles from './tokenSwap.module.scss'

import spinner from '../../spinner-s.gif'

export type TokenSelectInputProps = {
  token?: Token
  tokens: Token[]
  tokenSetter: React.Dispatch<React.SetStateAction<Token>>
  showBalance?: boolean
  balanceSetter?: React.Dispatch<React.SetStateAction<BigNumber>>
}

// Lets user pick a token using `TokenRequester`.
// In case this is the input token:
//   - User may enter an input amount.
//   - The ERC20 contract is polled for user's balance.
//     (Or `getBalance` is called, in case the input token is ether.)
//
// - `token`: Currently selected token
// - `tokens`: Tokens user may select from
// - `tokenSetter`: State setter that is called when a token is selected
// - `showBalance`: Should users's balance be fetched and displayed?
// - `balanceSetter`: State setter for setting balance in case `showBalance` is `true`
const TokenSelectInput: React.FC<TokenSelectInputProps> = ({
  token,
  tokens,
  tokenSetter,
  showBalance,
  balanceSetter,
}) => {
  const [isRequesterOpen, setIsRequesterOpen] = useState(false)

  const {account, active, chainId, library} = useWeb3React()

  const fetchTokenBalance = useCallback(
    async () => {
      if (account && token) {
        const api = new TokenSwapApi(library)

        let balance: BigNumber
        if (token.id === TokenId.WETH) {
          balance = await api.getBalance(account)
        } else {
          balance = await api.balanceOf(token.id, account)
        }
        if (balanceSetter) {
          balanceSetter(balance)
        }
        return balance
      }
    },
    [account, balanceSetter, library, token]
  )

  // Do not fetch balance if `showBalance` is `false`, or there is no active Web3 provider.
  const isPaused = useCallback(() => !showBalance || !active, [active, showBalance])

  // When `isPaused` is `false`, poll input token balance every 7 seconds.
  const {data: tokenBalance, error: tokenBalanceError} = useSWR(
    [account, chainId, token?.id],
    fetchTokenBalance,
    {
      refreshInterval: 7000,
      isPaused,
    }
  )

  const onTokenSelected = useCallback(
    (token?: Token) => {
      if (token) {
        tokenSetter(token)
      }
      setIsRequesterOpen(false)
    },
    [tokenSetter]
  )

  const isDisabled = tokens.length === 1

  const onRequestChange = useCallback(() => {
    if (!isDisabled) {
      setIsRequesterOpen(true)
    }
  }, [isDisabled])

  const onKeyUp = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === 'Enter') {
        onRequestChange()
      }
    },
    [onRequestChange]
  )

  const value = token ? (token.id === TokenId.WETH ? 'ETH' : token.symbol) : ''

  return (
    <>
      {showBalance && (
        <div className={classNames(styles.token0balance, {hidden: !active})}>
          <span>
            {token &&
              (tokenBalanceError ? (
                'Error fetching balance'
              ) : tokenBalance ? (
                `Your ${token.id === TokenId.WETH ? 'ETH' : token.symbol} balance: ${formatMoney(
                  tokenBalance,
                  token.decimals
                )}`
              ) : (
                <img src={spinner} />
              ))}
          </span>
        </div>
      )}
      <div
        className={classNames(styles.tokenSelect, {
          [styles.tokenSelectDisabled]: isDisabled,
        })}
        onClick={onRequestChange}>
        <input
          value={value}
          onClick={onRequestChange}
          onChange={onRequestChange}
          onKeyUp={onKeyUp}
        />
      </div>
      <TokenRequester
        isOpen={isRequesterOpen}
        onTokenSelected={onTokenSelected}
        tokens={tokens}
        initialToken={token}
      />
    </>
  )
}

export default TokenSelectInput
