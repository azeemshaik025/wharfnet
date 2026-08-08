import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { Logo } from './logo'
import 'nextra-theme-docs/style.css'
import './globals.css'

// The site is served under /wharfnet on GitHub Pages (see next.config.mjs).
// Metadata image URLs resolve against metadataBase (which has no path), so the
// basePath is included explicitly here. Served as a real PNG from public/, so
// link-preview crawlers get `Content-Type: image/png` (an extensionless route
// would be served as application/octet-stream and some crawlers reject it).
const basePath = process.env.NODE_ENV === 'production' ? '/wharfnet' : ''
const ogImage = {
  url: `${basePath}/og.png`,
  width: 1200,
  height: 630,
  alt: 'Wharfnet — one-command localnet for EVM, Solana, Starknet, Bitcoin, Litecoin & zkSync'
}

export const metadata = {
  // Origin used to resolve relative metadata URLs to absolute ones. Update this
  // (and basePath above) if a custom domain is configured.
  metadataBase: new URL('https://sainathr19.github.io'),
  title: {
    default: 'Wharfnet',
    template: '%s | Wharfnet'
  },
  description:
    'One-command localnet for EVM, Solana, Starknet, Bitcoin, Litecoin & zkSync — built-in faucet, pre-deployed test tokens and more.',
  openGraph: {
    title: 'Wharfnet',
    description:
      'One-command localnet for EVM, Solana, Starknet, Bitcoin, Litecoin & zkSync — built-in faucet, pre-deployed test tokens and more.',
    url: '/wharfnet',
    siteName: 'Wharfnet',
    type: 'website',
    images: [ogImage]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wharfnet',
    description:
      'One-command localnet for EVM, Solana, Starknet, Bitcoin, Litecoin & zkSync.',
    images: [ogImage.url]
  }
}

const navbar = (
  <Navbar logo={<Logo />} projectLink="https://github.com/sainathr19/wharfnet" />
)

const footer = (
  <Footer>
    MIT {new Date().getFullYear()} ©{' '}
    <a href="https://github.com/sainathr19/wharfnet" target="_blank" rel="noreferrer">
      Wharfnet
    </a>
  </Footer>
)

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head color={{ hue: 200, saturation: 90, lightness: 55 }} />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/sainathr19/wharfnet/tree/main/landing"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
