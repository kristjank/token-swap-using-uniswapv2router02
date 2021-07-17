import React, {useCallback, useMemo} from 'react'
import SelectSearch, {fuzzySearch} from 'react-select-search'

import Modal, {ModalProps} from '../utilityComponents/Modal'

import {Token} from '../../app/types'
import { TokenId } from '../../app/constants'

import '../../react-select-search.css'
import styles from './tokenSwap.module.scss'

export type TokenRequesterProps = Omit<ModalProps, 'onRequestClose'> & {
  onTokenSelected: (token?: Token) => void
  tokens: Token[]
  initialToken?: Token
}

// Ask user to select a token.
const TokenRequester: React.FC<TokenRequesterProps> = ({
  isOpen,
  onTokenSelected,
  tokens,
  initialToken,
}) => {
  const options = useMemo(() => {
    return tokens.map((token) => ({
      value: token.id,
      name: token.id === TokenId.WETH ? 'ETH' : token.symbol,
    }))
  }, [tokens])

  const onRequestClose = useCallback(() => {
    onTokenSelected()
  }, [onTokenSelected])

  const onChange = useCallback(
    (selectedTokenValue) => {
      const selectedTokenId = selectedTokenValue as string
      const token = tokens.find(({id, ...rest}) => id === selectedTokenId)
      onTokenSelected(token!)
    },
    [onTokenSelected, tokens]
  )

  return (
    <Modal isOpen={isOpen} windowClass={styles.tokenRequester} onRequestClose={onRequestClose}>
      <p>Select a token</p>
      <SelectSearch
        options={options}
        printOptions="always"
        search
        filterOptions={fuzzySearch}
        onChange={onChange}
        value={initialToken?.id}
      />
    </Modal>
  )
}

export default TokenRequester
