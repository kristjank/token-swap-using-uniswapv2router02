import {createAsyncThunk, createSlice} from '@reduxjs/toolkit'
import {WritableDraft} from 'immer/dist/internal'
import {RootState, AppDispatch} from '../../app/store'

import {Web3Provider} from '@ethersproject/providers'

import {TokenSwapApi} from './api'
import {StoreTransaction} from './types'

export interface TokenSwapState {
  transactions: StoreTransaction[]
}

const initialState: TokenSwapState = {
  transactions: [],
}

type TokenSwapThunkConfig = {
  state: RootState
  dispatch: AppDispatch
  rejectValue: string
}

type AwaitTransactionActionType = {
  meta: {
    arg: {
      transaction: StoreTransaction
    }
  }
}

// Push transaction to store and wait for it to have at least one block confirmation.
// Action is rejected if transaction does not receive confirmation, or the `TransactionReceipt`
// has a `status` value of 0. Transaction is removed from store when action is fulfilled or rejected.
export const awaitTransaction = createAsyncThunk<
  number | undefined,
  {transaction: StoreTransaction; library: Web3Provider},
  TokenSwapThunkConfig
>('tokenSwap/awaitTransaction', async ({transaction, library}, {getState, rejectWithValue}) => {
  const {hash} = transaction
  const state = getState().tokenSwap

  if (state.transactions.findIndex(({hash: storedHash}) => storedHash === hash) !== -1) {
    rejectWithValue('already awaiting')
  }

  try {
    const api = new TokenSwapApi(library)
    const status: number | undefined = await api.awaitTransaction(hash)
    if (status === undefined) {
      rejectWithValue('status undefined')
    } else {
      return status
    }
  } catch (ex) {
    rejectWithValue(ex.toString())
  }
})

const addTransaction: (
  state: WritableDraft<TokenSwapState>,
  action: AwaitTransactionActionType
) => void = (state, action) => {
  const transaction = action.meta.arg.transaction
  if (state.transactions.findIndex(({hash}) => hash === transaction.hash) === -1) {
    state.transactions.push(transaction)
  }
}

const removeTransaction: (
  state: WritableDraft<TokenSwapState>,
  action: AwaitTransactionActionType
) => void = (state, action) => {
  const transaction = action.meta.arg.transaction
  state.transactions = state.transactions.filter(({hash}) => hash !== transaction.hash)
}

// Keeps track of transactions waiting to complete (where 'complete' can also mean that
// a transaction is reverted).
export const TokenSwapSlice = createSlice({
  name: 'tokenSwap',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(awaitTransaction.pending, addTransaction)
    builder.addCase(awaitTransaction.fulfilled, removeTransaction)
    builder.addCase(awaitTransaction.rejected, removeTransaction)
  },
})

export const selectTokenSwap = (state: RootState) => state.tokenSwap

export default TokenSwapSlice.reducer
