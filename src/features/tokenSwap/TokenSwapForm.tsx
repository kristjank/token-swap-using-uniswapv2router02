import React, {useCallback, useMemo, useState} from 'react'
import {useAppDispatch} from '../../app/hooks'

import useSWR from 'swr'
import {useWeb3React} from '@web3-react/core'
import {BigNumber, ethers} from 'ethers'
import {TransactionResponse} from '@ethersproject/providers'

import {getPairableTokens} from '../uniswapSubgraph/api'
import {Pair, Token} from '../../app/types'

import {awaitTransaction} from './slice'
import {StoreTransaction, StoreTransactionType} from './types'
import {TokenSwapApi, formatMoney, fromRawAmount} from './api'
import TokenSelectInput from './TokenSelectInput'

import DebouncedInput from '../utilityComponents/DebouncedInput'

import classNames from 'classnames'
import styles from './tokenSwap.module.scss'

import spinner from '../../spinner-s.gif'

import {TokenId, ZERO_WIDTH_SPACE} from '../../app/constants'

const TX_TIMEOUT_SECONDS = 600

export type TokenSwapFormProps = {
  pairs: Pair[]
  tokens: Token[]
}

// `TokenSwapForm` is initially passed the `pairs` received from the UniswapV2 subgraph,
// and the list of `tokens` derived from `pairs` (i.e. all tokens that are in at least one
// of the pairs).
const TokenSwapForm: React.FC<TokenSwapFormProps> = ({pairs, tokens}) => {
  const dispatch = useAppDispatch()

  // Pick the default pair: the first pair which has ether as `token0`.
  // If there is none (which is unlikely), fall back on the first pair.
  const fstPair = useMemo(
    () => pairs.find(({token0, ...rest}) => token0.id === TokenId.WETH) || pairs[0],
    [pairs]
  )

  const [token0, setToken0] = useState(fstPair?.token0)
  const [token1, setToken1] = useState(fstPair?.token1)
  const [inputAmount, setInputAmount] = useState('0')
  const [token0Balance, setToken0Balance] = useState(ethers.constants.Zero)

  const {account, active, chainId, library} = useWeb3React()

  // When both tokens are selected, and there is an input amount,
  // calculate the projected output amount based on the pair's reserves.
  const fetchOutputAmount = useCallback(async () => {
    if (account && inputAmount && token0 && token1) {
      const api = new TokenSwapApi(library)
      const pair = pairs.find(
        ({token0: pairToken0, token1: pairToken1, ...rest}) =>
          (pairToken0.id === token0.id && pairToken1.id === token1.id) ||
          (pairToken0.id === token1.id && pairToken1.id === token0.id)
      )
      if (pair) {
        return await api.getOutputAmount(pair, token0.id, inputAmount)
      }
    }
  }, [account, inputAmount, library, pairs, token0, token1])

  // Check if UniswapV2Router02 is approved for spending user's tokens.
  // The amount is not checked, since the API always approves UniswapV2Router02
  // for a value of `MaxUint256`.
  const fetchAllowance = useCallback(async () => {
    if (account && inputAmount && token0 && token0.id !== TokenId.WETH) {
      const api = new TokenSwapApi(library)
      const allowance = await api.allowance(token0.id, account)
      return allowance
    }
  }, [account, inputAmount, library, token0])

  // Only poll when there is an active Web3 provider, and an input amount was set.
  const isPaused = useCallback(() => !active || inputAmount === '', [active, inputAmount])

  // Poll for output amount every 14 seconds, or when one of the dependencies changes.
  const {data: outputAmount} = useSWR(
    [account, chainId, inputAmount, token0?.id, token1?.id],
    fetchOutputAmount,
    {
      refreshInterval: 14000,
      isPaused,
    }
  )

  // Poll for token approval.
  const {data: allowance} = useSWR([account, chainId, inputAmount, token0?.id], fetchAllowance, {
    refreshInterval: 7000,
    isPaused,
  })

  const onSubmit = useCallback((ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
  }, [])

  // Get a list of tokens that can be paired with `token0`.
  const pairableTokens = useMemo(() => getPairableTokens(token0, tokens, pairs), [
    token0,
    tokens,
    pairs,
  ])

  // If `token1` is pairable, keep it. Otherwise, fall back to any pairable token, or none.
  const otherToken =
    pairableTokens.find(({id, ...rest}) => id === token1.id) ||
    (pairableTokens.length === 1 ? pairableTokens[0] : undefined)

  if (otherToken && otherToken.id !== token1.id) {
    setToken1(otherToken)
  }

  // When user types in the input amount field, blank `inputAmount` to halt polling.
  const onInputAmountInput = useCallback(
    () => {
      setInputAmount('')
    },
    [setInputAmount]
  )

  // Once user finishes typing the input amount, commit it to state.
  const onInputAmountCommitChange = useCallback(
    (target: HTMLInputElement) => {
      const value = target.valueAsNumber
      const inputAmountRaw = isNaN(value) ? '0.0' : String(value)
      setInputAmount(inputAmountRaw)
    },
    [setInputAmount]
  )

  const isApprovalNeeded = !allowance || allowance.eq(ethers.constants.Zero)

  // Depending on the input token's approval state, approve it, or execute the swap.
  const swapOrApprove = useCallback(async () => {
    if (account && inputAmount && outputAmount && !outputAmount.eq(ethers.constants.Zero)) {
      const api = new TokenSwapApi(library)
      let tx: TransactionResponse
      let transactionType: StoreTransactionType

      if (token0.id !== TokenId.WETH && isApprovalNeeded) {
        tx = await api.approve(token0)
        transactionType = StoreTransactionType.APPROVAL
      } else {
        const deadline = BigNumber.from(
          Math.trunc(new Date().getTime() / 1000) + TX_TIMEOUT_SECONDS
        )
        tx = await api.swapExactForVolatile(inputAmount, outputAmount, [token0, token1], deadline)
        transactionType = StoreTransactionType.SWAP
      }

      const transaction: StoreTransaction = {
        hash: tx.hash,
        type: transactionType,
        associatedToken: token0.id,
      }

      // Keep transaction in store until it either succeeds or fails.
      dispatch(awaitTransaction({transaction, library}))
    }
  }, [account, dispatch, inputAmount, isApprovalNeeded, library, outputAmount, token0, token1])

  const onSwapButtonClicked = useCallback(async (ev: React.MouseEvent<HTMLButtonElement>) => {
    ev.preventDefault()
    swapOrApprove()
  }, [swapOrApprove])

  const isInputAmountChanging = inputAmount === ''

  const insufficientBalance =
    !!inputAmount && token0 && fromRawAmount(inputAmount, token0.decimals).gt(token0Balance)

  const isSwapButtonDisabled =
    isInputAmountChanging ||
    insufficientBalance ||
    !inputAmount ||
    !outputAmount ||
    outputAmount.eq(ethers.constants.Zero)

  let swapButtonCaption: string
  if (insufficientBalance) {
    swapButtonCaption = 'Insufficient balance'
  } else if (token0 && token0.id !== TokenId.WETH && isApprovalNeeded) {
    swapButtonCaption = `Approve ${token0.symbol}`
  } else {
    swapButtonCaption = 'Swap'
  }

  return (
    <>
      <div className={styles.swapForm}>
        <p>Swap</p>
        <form onSubmit={onSubmit}>
          <div className={styles.tokenAmountContainer}>
            <TokenSelectInput
              token={token0}
              tokens={tokens}
              tokenSetter={setToken0}
              showBalance
              balanceSetter={setToken0Balance}
            />
            <DebouncedInput
              type="number"
              placeholder="0.00000"
              step="0.00001"
              onInput={onInputAmountInput}
              onCommitChange={onInputAmountCommitChange}
            />
          </div>
          <div className={styles.arrow} />
          <div className={styles.tokenAmountContainer}>
            <TokenSelectInput token={otherToken} tokens={pairableTokens} tokenSetter={setToken1} />
            <input
              className={classNames({[styles.inputChanging]: isInputAmountChanging})}
              type="text"
              disabled
              placeholder="0.00000"
              value={
                isInputAmountChanging || !outputAmount
                  ? ZERO_WIDTH_SPACE
                  : formatMoney(outputAmount, token1.decimals)
              }
            />
            {isInputAmountChanging && <img className={styles.inputChangingSpinner} src={spinner} />}
          </div>
          <button
            onClick={onSwapButtonClicked}
            disabled={isSwapButtonDisabled}
            className={classNames('button', styles.swapButton, {
              [styles.swapButtonDisabled]: isSwapButtonDisabled,
            })}>
            {swapButtonCaption}
          </button>
        </form>
      </div>
    </>
  )
}

export default TokenSwapForm
