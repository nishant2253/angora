'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount } from 'wagmi'
import { PhantomConnectButton } from '@/components/wallet/PhantomButton'
import { useWallet } from '@/hooks/useWallet'

// Section 10 spec — exact nav items list
const NAV_ITEMS = [
  { label: 'Platform',   href: '/' },
  { label: 'Agents',     href: '/agents' },     // Agent control panel
  { label: 'Strategies', href: '/strategies' }, // Strategy catalogue
  { label: 'Markets',    href: '/markets' },    // Live market data
  { label: 'Research',   href: '/research' },   // AI market insights
  { label: 'Docs',       href: '/docs' },       // Documentation
]

export function Navbar() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { monBalance } = useWallet()

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-3 border-b border-angora-border/50 bg-angora-bg/80 backdrop-blur-md"
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 rounded bg-angora-primary/20 border border-angora-primary/40 grid place-items-center">
          <div className="w-2 h-2 rounded-full bg-angora-primary" />
        </div>
        <span className="font-bold text-sm tracking-tight text-white">ANGORA</span>
      </Link>

      {/* Nav Links — active route highlighting (Section 10 spec) */}
      <div className="hidden md:flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          // Exact match for root, prefix match for all others
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={
                isActive
                  ? 'text-sm text-white border-b border-angora-primary pb-0.5 transition-colors duration-200'
                  : 'text-sm text-angora-muted hover:text-white transition-colors duration-200'
              }
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Portal / Create link */}
        <Link
          href="/create"
          className={
            pathname === '/create'
              ? 'hidden sm:block px-4 py-2 text-sm border rounded-lg border-angora-primary/60 text-white transition-colors duration-200'
              : 'hidden sm:block px-4 py-2 text-sm border rounded-lg text-angora-muted border-angora-border hover:border-angora-primary/50 hover:text-white transition-colors duration-200'
          }
        >
          Portal
        </Link>

        {/* Wallet button — Section 10 spec: clicking address goes to /wallet */}
        {isConnected && address ? (
          <Link
            href="/wallet"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-angora-border bg-angora-surface/80 backdrop-blur-sm hover:border-angora-primary/50 transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-angora-accent font-mono text-sm">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <span className="text-angora-muted text-xs hidden sm:inline">
              {parseFloat(monBalance).toFixed(2)} MON
            </span>
          </Link>
        ) : (
          <PhantomConnectButton />
        )}
      </div>
    </motion.nav>
  )
}
