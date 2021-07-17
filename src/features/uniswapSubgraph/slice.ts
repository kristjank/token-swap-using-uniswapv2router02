import {createAsyncThunk, createSlice} from '@reduxjs/toolkit'
import {AnyAsyncThunk, RejectedActionFromAsyncThunk} from '@reduxjs/toolkit/dist/matchers'
import {RootState, AppDispatch} from '../../app/store'

import {Pair, PromisedReturnType, Token} from '../../app/types'
import {fetchTopPairs} from './api'

export interface UniswapSubgraphState {
  loading: boolean
  error?: string
  pairs: Pair[]
  tokens: Token[]
}

const initialState: UniswapSubgraphState = {
  loading: false,
  pairs: [],
  tokens: [],
}

type UniswapSubgraphThunkConfig = {
  state: RootState
  dispatch: AppDispatch
  rejectValue: string
}

// Fetch pairs from UniswapV2 subgraph.
export const getTopPairs = createAsyncThunk<
  PromisedReturnType<typeof fetchTopPairs>,
  void,
  UniswapSubgraphThunkConfig
>('uniswapSubgraph/getTopPairs', async (_, {rejectWithValue}) => {
  try {
    return await fetchTopPairs()
  } catch (err) {
    return rejectWithValue(err?.message)
  }
})

const startLoading = (state: UniswapSubgraphState) => {
  state.error = undefined
  state.loading = true
}

const stopLoading = (state: UniswapSubgraphState) => {
  state.loading = false
}

const receiveError = <T extends AnyAsyncThunk>(
  state: UniswapSubgraphState,
  action: RejectedActionFromAsyncThunk<T>
) => {
  stopLoading(state)

  console.log(`assigning error to state: ${action.payload}`)

  Object.assign(state, {
    loading: false,
    error: action.payload,
  })
}

export const uniswapSubgraphSlice = createSlice({
  name: 'uniswapSubgraph',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getTopPairs.pending, startLoading)
    builder.addCase(getTopPairs.fulfilled, (state, action) => {
      stopLoading(state)
      const { pairs, tokens } = action.payload
      state.pairs = pairs
      state.tokens = tokens
    })
    builder.addCase(getTopPairs.rejected, receiveError)
  },
})

export const selectUniswapSubgraph = (state: RootState) => state.uniswapSubgraph

export default uniswapSubgraphSlice.reducer
