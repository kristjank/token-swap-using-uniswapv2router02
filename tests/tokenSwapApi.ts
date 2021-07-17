import hre, {ethers} from 'hardhat'

// The `expect` object imported from `testUtil` uses the matchers from
// `ethereum-waffle` as well as `chai-as-promised`.
import {expect} from './testUtil'

import {TokenSwapApi, formatMoney, fromRawAmount} from '../src/features/tokenSwap/api'
import {BigNumber, Contract, Signer} from 'ethers'
const {parseEther} = ethers.utils

import {IERC20, IERC20__factory} from '../src/typechain'
import {IUniswapV2Pair, IUniswapV2Pair__factory} from '../src/typechain'
import {IUniswapV2Router02, IUniswapV2Router02__factory} from '../src/typechain'

import {smockit} from '@eth-optimism/smock'

import {Pair, Token} from '../src/app/types'
import pairs from '../src/features/tokenSwap/fixtures/pairs.json'
import tokens from '../src/features/tokenSwap/fixtures/tokens.json'
import {PairId, TokenId, UNISWAP_V2_ROUTER02} from '../src/app/constants'

import {FORKING_BLOCK_NUMBER, INITIAL_BALANCE_ETHER, JSON_RPC_URL} from '../src/envVars'

const getTokenById: (id: string) => Token = (id) => {
  return tokens.find(({id: tokenId}) => tokenId === id)!
}

const getPairById: (id: string) => Pair = (id) => {
  return pairs.find(({id: pairId}) => pairId === id)!
}

const resetFork = () =>
  hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: JSON_RPC_URL,
          blockNumber: FORKING_BLOCK_NUMBER,
        },
      },
    ],
  })

describe('Token swap API', () => {
  let signers: Signer[]
  let signer: Signer
  let signerAddr: string

  let api: TokenSwapApi

  let router: IUniswapV2Router02
  let DAI: IERC20
  let USDC: IERC20
  let WETH: IERC20
  let DAI_USDC: IUniswapV2Pair
  let mockDAI: Contract
  let mockUSDC: Contract
  let mockWETH: Contract
  let mockDAI_USDC: Contract

  before(async () => {
    // Fork is reset at the beginning of the test suite, but not between individual tests (!).
    await resetFork()

    signers = await ethers.getSigners()
    signer = signers[0]
    signerAddr = await signer.getAddress()

    api = new TokenSwapApi(ethers.provider)

    router = IUniswapV2Router02__factory.connect(UNISWAP_V2_ROUTER02, signer)
    DAI = IERC20__factory.connect(TokenId.DAI, signer)
    USDC = IERC20__factory.connect(TokenId.USDC, signer)
    WETH = IERC20__factory.connect(TokenId.WETH, signer)
    DAI_USDC = IUniswapV2Pair__factory.connect(PairId.DAI_USDC, signer)
  })

  beforeEach(async () => {
    mockDAI = await smockit(DAI)
    mockUSDC = await smockit(USDC)
    mockWETH = await smockit(WETH)
    mockDAI_USDC = await smockit(DAI_USDC)
  })

  it('gets ether balance of account', async () => {
    return expect(api.getBalance(signerAddr)).to.eventually.eq(parseEther(INITIAL_BALANCE_ETHER))
  })

  it('gets ERC20 token balance of account', async () => {
    const mockBalance = BigNumber.from(123)
    mockDAI.smocked.balanceOf.will.return.with(mockBalance)
    return expect(api.balanceOf(mockDAI.address, signerAddr)).to.eventually.eq(mockBalance)
  })

  it('calculates amount of token units using `fromRawAmount`', () => {
    const amountRaw = '1.23456'
    const decimals = 18
    const bnAmountInTokenUnits = BigNumber.from('1234560000000000000')

    expect(fromRawAmount(amountRaw, decimals)).to.eq(bnAmountInTokenUnits)
  })

  it('formats amount of token units to money string', () => {
    const bnAmountInTokenUnits = BigNumber.from('1234565445577654321')
    const decimals = 18

    expect(formatMoney(bnAmountInTokenUnits, decimals)).to.eq('1.23457')
  })

  it('calculates output amount based on reserves', async () => {
    let pairDAI_USDC: Pair = getPairById(PairId.DAI_USDC)
    const decimalsDAI = pairDAI_USDC.token0.decimals
    const decimalsUSDC = pairDAI_USDC.token1.decimals

    const numInputReserve = 1234567
    const numOutputReserve = 1567234
    const numInputAmount = 10000

    const mockInputReserve = fromRawAmount(String(numInputReserve), decimalsUSDC)
    const mockOutputReserve = fromRawAmount(String(numOutputReserve), decimalsDAI)

    mockDAI_USDC.smocked.getReserves.will.return.with([
      mockOutputReserve, // order!
      mockInputReserve,
      0,
    ])

    pairDAI_USDC = Object.assign({}, pairDAI_USDC, {id: mockDAI_USDC.address})
    const outputAmount = await api.getOutputAmount(
      pairDAI_USDC,
      TokenId.USDC,
      String(numInputAmount)
    )
    expect(formatMoney(outputAmount, decimalsDAI)).to.eq(
      (
        (997 * numInputAmount * numOutputReserve) /
        (997 * numInputAmount + 1000 * numInputReserve)
      ).toFixed(5)
    )
  })

  it("allows UniswapV2Router02 to spend `MaxUint256` of signer's balance of token", async () => {
    const tokenDAI: Token = getTokenById(TokenId.DAI)
    const tx = await api.approve(tokenDAI)
    await tx.wait()
    const allowance = await api.allowance(TokenId.DAI, signerAddr)
    expect(allowance).to.eq(ethers.constants.MaxUint256)
  })

  it('swaps exact ether for token', async () => {
    const tokenWETH = getTokenById(TokenId.WETH)
    const tokenDAI = getTokenById(TokenId.DAI)
    const deadline = BigNumber.from(Math.trunc(new Date().getTime() / 1000) + 600)
    const inputAmountRaw = '1.0'

    const pairDAI_WETH = getPairById(PairId.DAI_WETH)
    const outputAmountMin = await api.getOutputAmount(pairDAI_WETH, TokenId.WETH, inputAmountRaw)

    const tx = await api.swapExactForVolatile(
      inputAmountRaw,
      outputAmountMin,
      [tokenWETH, tokenDAI],
      deadline
    )
    const rcpt = await tx.wait()
    expect(rcpt.status).to.eq(1)

    const balanceDAI = await api.balanceOf(TokenId.DAI, signerAddr)
    const slippageAdjustedMinOutput = outputAmountMin
      .mul(BigNumber.from(100))
      .div(BigNumber.from(101))
    expect(balanceDAI).to.be.gte(slippageAdjustedMinOutput)
  })

  it('swaps exact token for token', async () => {
    // Requiring effects of:
    // - "allows UniswapV2Router02 to spend `MaxUint256` of signer's balance of token"
    // - 'swaps exact ether for token'

    const tokenDAI = getTokenById(TokenId.DAI)
    const tokenUSDC = getTokenById(TokenId.USDC)
    const deadline = BigNumber.from(Math.trunc(new Date().getTime() / 1000) + 600)

    const balanceDAI = await api.balanceOf(TokenId.DAI, signerAddr)
    const inputAmountRaw = (0.95 * Number(formatMoney(balanceDAI, tokenDAI.decimals))).toFixed(5)

    const pairDAI_USDC: Pair = getPairById(PairId.DAI_USDC)
    const outputAmountMin = await api.getOutputAmount(pairDAI_USDC, TokenId.DAI, inputAmountRaw)

    const tx = await api.swapExactForVolatile(
      inputAmountRaw,
      outputAmountMin,
      [tokenDAI, tokenUSDC],
      deadline
    )
    const rcpt = await tx.wait()
    expect(rcpt.status).to.eq(1)

    const balanceUSDC = await api.balanceOf(TokenId.USDC, signerAddr)
    const slippageAdjustedMinOutput = outputAmountMin
      .mul(BigNumber.from(100))
      .div(BigNumber.from(101))

    expect(balanceUSDC).to.be.gte(slippageAdjustedMinOutput)
  })

  it('swaps exact token for ether', async () => {
    // Requiring effects of:
    // - 'swaps exact token for token' (Signer has USDC balance.)

    const tokenUSDC = getTokenById(TokenId.USDC)
    const tokenWETH = getTokenById(TokenId.WETH)
    const deadline = BigNumber.from(Math.trunc(new Date().getTime() / 1000) + 600)

    const balanceUSDC = await api.balanceOf(TokenId.USDC, signerAddr)
    const inputAmountRaw = (0.95 * Number(formatMoney(balanceUSDC, tokenUSDC.decimals))).toFixed(5)

    const pairUSDC_WETH: Pair = getPairById(PairId.USDC_WETH)
    const outputAmountMin = await api.getOutputAmount(pairUSDC_WETH, TokenId.USDC, inputAmountRaw)

    // Need to approve router for USDC first.
    let tx = await api.approve(tokenUSDC)
    let rcpt = await tx.wait()
    expect(rcpt.status).to.eq(1)

    const balanceWETH_before = await api.getBalance(signerAddr)

    tx = await api.swapExactForVolatile(
      inputAmountRaw,
      outputAmountMin,
      [tokenUSDC, tokenWETH],
      deadline
    )
    rcpt = await tx.wait()
    expect(rcpt.status).to.eq(1)

    const balanceWETH_after = await api.getBalance(signerAddr)
    const etherFromSwap = balanceWETH_after.sub(balanceWETH_before)

    const slippageAdjustedMinOutput = outputAmountMin
      .mul(BigNumber.from(100))
      .div(BigNumber.from(101))

    expect(etherFromSwap).to.be.gte(slippageAdjustedMinOutput)
  })
})
