import '../styles/globals.css'
import { WalletProvider } from '../src/contexts/WalletContext'

function MyApp({ Component, pageProps }) {
  return (
    <WalletProvider>
      <Component {...pageProps} />
    </WalletProvider>
  )
}

export default MyApp
