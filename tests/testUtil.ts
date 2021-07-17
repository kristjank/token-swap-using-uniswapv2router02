// Some utilities for testing contracts:
//   - Chai `expect` pre-loaded with `ethereum-waffle` and `chai-as-promised`
//   - Promised transaction success/failure assertions heeding the transaction
//     receipt's `status` field

import {TransactionResponse} from '@ethersproject/providers'

import * as _chai from 'chai'
import {solidity} from 'ethereum-waffle'
import chaiAsPromised from 'chai-as-promised'
_chai.use(solidity)
_chai.use(chaiAsPromised)

export const chai = _chai

export const expect = _chai.expect

export const expectStatusOK = (tx: TransactionResponse) =>
  expect(tx.wait()).to.eventually.have.property('status', 1)

const _statusFailPromise: (tx: TransactionResponse) => Promise<boolean> = (tx) =>
  new Promise(async (rslv) => {
    try {
      const rcpt = await tx.wait()
      rslv(rcpt.status === 0)
    } catch (ex) {
      rslv(ex.toString().indexOf('transaction failed') !== -1)
    }
  })

export const expectStatusFail = (tx: TransactionResponse) =>
  expect(_statusFailPromise(tx)).to.eventually.be.true
