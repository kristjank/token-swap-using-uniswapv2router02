export type Token = {
  id: string
  symbol: string
  decimals: number
}

export type Pair = {
  id: string
  reserveUSD: string
  token0: Token
  token1: Token
}

export type PromisedType<P> = P extends Promise<infer T> ? T : never

export type PromisedReturnType<T extends (...args: any) => unknown> = PromisedType<ReturnType<T>>
