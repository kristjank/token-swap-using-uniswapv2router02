import React from 'react'
import {Meta} from '@storybook/react'

import TokenSwapForm, {TokenSwapFormProps} from './TokenSwapForm'

import pairs from './fixtures/pairs.json'
import tokens from './fixtures/tokens.json'

export default {
  component: TokenSwapForm,
  title: 'Components/TokenSwapForm',
} as Meta

const props: TokenSwapFormProps = {
  pairs,
  tokens,
}

export const Primary: React.VFC<{}> = () => <TokenSwapForm {...props} />
