import {configureStore, ThunkAction, Action} from '@reduxjs/toolkit'
import tokenSwapReducer from '../features/tokenSwap/slice'
import uniswapSubgraphReducer from '../features/uniswapSubgraph/slice'

export const store = configureStore({
  reducer: {
    tokenSwap: tokenSwapReducer,
    uniswapSubgraph: uniswapSubgraphReducer,
  },
})

export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>
