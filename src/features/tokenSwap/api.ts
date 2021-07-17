import {BigNumber, BigNumberish, ethers} from 'ethers'
import {formatUnits} from 'ethers/lib/utils'
import {TransactionResponse, JsonRpcProvider} from '@ethersproject/providers'

import {
  IERC20__factory,
  IUniswapV2Pair__factory,
  IUniswapV2Router02__factory,
} from '../../typechain'
import {TokenId, UNISWAP_V2_ROUTER02} from '../../app/constants'

import {Pair, Token} from '../../app/types'

import invariant from 'tiny-invariant'

// Constant slippage tolerance of one percent. Normally this would be a parameter
// adjustable from the UI.
const SLIPPAGE_TOLERANCE_PERCENT = 1

// Interface for various UniswapV2Router02, UniswapV2Pair, and ERC20 functions.
export class TokenSwapApi {
  constructor(private provider: JsonRpcProvider) {}

  // Get ether balance of account.
  getBalance: (account: string) => Promise<BigNumber> = async (account) => {
    return await this.provider.getBalance(account)
  }

  // Get ERC20 token balance of account.
  balanceOf: (erc20addr: string, account: string) => Promise<BigNumber> = async (
    erc20addr,
    account
  ) => {
    const token = IERC20__factory.connect(erc20addr, this.provider)
    return await token.balanceOf(account)
  }

  // Given a pair, the input token address, and the input amount,
  // return the projected output amount based on the pair's reserves.
  getOutputAmount: (
    pair: Pair,
    inputAddr: string,
    inputAmountRaw: string
  ) => Promise<BigNumber> = async (pair, inputAddr, inputAmountRaw) => {
    const {token0, token1} = pair
    invariant(
      inputAddr === pair.token0.id || inputAddr === pair.token1.id,
      '`inputAddr` must be one of the pair tokens'
    )

    const parity = token0.id === inputAddr
    const [inputToken, _outputToken]: [Token, Token] = parity ? [token0, token1] : [token1, token0]

    const inputAmount: BigNumber = fromRawAmount(inputAmountRaw, inputToken.decimals)

    // Call pair contract to fetch current reserves.
    const pairInstance = IUniswapV2Pair__factory.connect(pair.id, this.provider)
    const {reserve0, reserve1} = await pairInstance.getReserves()
    const [inputReserve, outputReserve] = parity ? [reserve0, reserve1] : [reserve1, reserve0]

    // Adjust `inputAmount` for Uniswap's 0.3% trading fee.
    const feeAdjustedInputAmount = BigNumber.from(997).mul(inputAmount)

    const outputAmount = feeAdjustedInputAmount
      .mul(outputReserve)
      .div(feeAdjustedInputAmount.add(BigNumber.from(1000).mul(inputReserve)))

    return outputAmount
  }

  // Query ERC20 token for amount UniswapV2Router02 is allowed to spend on owner's behalf.
  allowance: (tokenAddr: string, owner: string) => Promise<BigNumber> = (tokenAddr, owner) => {
    const tokenInstance = IERC20__factory.connect(tokenAddr, this.provider)
    return tokenInstance.allowance(owner, UNISWAP_V2_ROUTER02)
  }

  // Approve UniswapV2Router02 for spending `MaxUint256` of token on signer's behalf.
  // Amount is always `MaxUint256` so each token needs to be approved only once.
  approve: (token: Token) => Promise<TransactionResponse> = (token) => {
    const signer = this.provider.getSigner()
    const inputTokenInstance = IERC20__factory.connect(token.id, signer)
    return inputTokenInstance.approve(UNISWAP_V2_ROUTER02, ethers.constants.MaxUint256)
  }

  // Swap an exact amount of input ether or token for a non-exact amount of output ether or token.
  // One of three `swapExact…` functions provided by UniswapV2Router02 is called based on whether
  // the input or the output, or neither, is ether.
  //
  // - `outputAmountMin`: minimum output amount required for this transaction not to revert,
  //   in units of output token (i.e. multiplied by 10 to the power of the token's `decimals` property)
  // - `pathTokens`: input and output token. Normally this function would support multi-hop swaps,
  //   i.e. swaps for which no direct pair exists, and which therefore need to be routed across multiple
  //   pairs. This was omitted for simplicity's sake.
  // - `deadline`: Unix timestamp of time before which the swap must succeed in order not to revert
  //
  // Returns a promised `TransactionResponse` the consumer can await to resolve.
  swapExactForVolatile: (
    inputAmountRaw: string,
    outputAmountMin: BigNumber,
    pathTokens: [Token, Token],
    deadline: BigNumber
  ) => Promise<TransactionResponse> = async (
    inputAmountRaw,
    outputAmountMin,
    pathTokens,
    deadline
  ) => {
    const [inputToken, outputToken] = pathTokens
    const path = [inputToken.id, outputToken.id]
    const inputAmount: BigNumber = fromRawAmount(inputAmountRaw, inputToken.decimals)

    const slippageAdjustedOutputAmount = BigNumber.from(100)
      .mul(outputAmountMin)
      .div(BigNumber.from(100 + SLIPPAGE_TOLERANCE_PERCENT))

    const signer = this.provider.getSigner()
    const signerAddr = await signer.getAddress()
    const router = IUniswapV2Router02__factory.connect(UNISWAP_V2_ROUTER02, signer)

    let promiseTx: Promise<TransactionResponse>

    if (inputToken.id === TokenId.WETH) {
      promiseTx = router.swapExactETHForTokens(
        slippageAdjustedOutputAmount,
        path,
        signerAddr,
        deadline,
        {
          value: inputAmount,
          gasLimit: 200000,
        }
      )
    } else if (outputToken.id === TokenId.WETH) {
      promiseTx = router.swapExactTokensForETH(
        inputAmount,
        slippageAdjustedOutputAmount,
        path,
        signerAddr,
        deadline,
        {
          gasLimit: 200000,
        }
      )
    } else {
      promiseTx = router.swapExactTokensForTokens(
        inputAmount,
        slippageAdjustedOutputAmount,
        path,
        signerAddr,
        deadline,
        {
          gasLimit: 200000,
        }
      )
    }

    return promiseTx
  }

  // Wait for transaction to exist on the blockchain for at least one block.
  // Returns `status` value of `TransactionReceipt`.
  awaitTransaction: (txHash: string) => Promise<number | undefined> = async (txHash) => {
    const tx = await this.provider.getTransaction(txHash)
    const rcpt = await tx.wait()
    return rcpt.status
  }
}

// Format money given token's `decimals` property.
export const formatMoney: (amount: BigNumberish, decimals: BigNumberish) => string = (
  amount,
  decimals
) => {
  return Number(formatUnits(amount, decimals)).toFixed(5)
}

// Convert amount from string to BigNumber, in token units, give token's `decimals` property.
export const fromRawAmount: (amountRaw: string, decimals: number) => BigNumber = (
  amountRaw,
  decimals
) => {
  return BigNumber.from(BigInt(Math.trunc(10 ** decimals * Number(amountRaw))))
}
