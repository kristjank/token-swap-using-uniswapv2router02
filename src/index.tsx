import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import {store} from './app/store'
import {Provider} from 'react-redux'

import {Web3Provider} from '@ethersproject/providers'
import {Web3ReactProvider} from '@web3-react/core'


function getLibrary(provider: any): Web3Provider {
  const library = new Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

ReactDOM.render(
  <React.StrictMode>
    <Web3ReactProvider getLibrary={getLibrary}>
      <Provider store={store}>
        <App />
      </Provider>
    </Web3ReactProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
