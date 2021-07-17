import {ApolloClient, HttpLink, InMemoryCache, gql} from '@apollo/client/core'
import fetch from 'cross-fetch'

import {Pair, Token} from '../../app/types'
import {TokenId} from '../../app/constants'

// Initialize client that connects to the UniswapV2 subgraph.
const cache = new InMemoryCache()
const client = new ApolloClient({
  cache: cache,
  link: new HttpLink({
    uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
    fetch,
  }),
})

// Query subgraph for top 100 pairs by USD reserve.
const TOP_PAIRS = gql`
  {
    pairs(
      where: {
        token0_not: "${TokenId.UETH}",
        token1_not: "${TokenId.UETH}"
      },
      orderBy: reserveUSD,
      orderDirection: desc,
      first: 100
    ) {
      id
      token0 {
        id
        symbol
        decimals
      }
      token1 {
        id
        symbol
        decimals
      }
      reserveUSD
    }
  }
`

export const fetchTopPairs: () => Promise<{
  pairs: Pair[]
  tokens: Token[]
}> = async () => {

  // Fetch pairs from subgraph.
  const result = await client.query({
    query: TOP_PAIRS,
  })

  // `decimals` property needs type conversion.
  const pairs: Pair[] = result.data.pairs.map((p: any) => {
    const token0: Token = Object.assign({}, {...p.token0, decimals: Number(p.token0.decimals)})
    const token1: Token = Object.assign({}, {...p.token1, decimals: Number(p.token1.decimals)})
    return Object.assign({}, {...p, token0, token1})
  })

  // Extract tokens from pairs.
  const tokens = Array.from(
    new Set(
      pairs
        .reduce((allTokens, {token0, token1, ...rest}) => {
          allTokens.push(token0, token1)
          return allTokens
        }, [] as Token[])
        .map((token) => JSON.stringify(token))
    )
  )
    .map((stringified) => JSON.parse(stringified) as Token)
    .filter((token) => token.id !== TokenId.ALCHEMIST)
    .sort((fst, snd) => {
      if (fst.id === TokenId.WETH) return -1
      if (snd.id === TokenId.WETH) return 1
      return fst.symbol.localeCompare(snd.symbol)
    })
  return {pairs, tokens}
}

// Return all tokens for which a pair exists where the other token is `inputToken`.
export const getPairableTokens: (inputToken: Token, tokens: Token[], pairs: Pair[]) => Token[] = (
  inputToken,
  tokens,
  pairs
) => {
  return tokens.filter(
    ({id, ...rest}) =>
      pairs.findIndex(
        ({token0, token1, ...rest}) =>
          (id === token0.id && inputToken.id === token1.id) ||
          (id === token1.id && inputToken.id === token0.id)
      ) !== -1
  )
}
