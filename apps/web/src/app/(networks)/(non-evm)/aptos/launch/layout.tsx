import { SUPPORTED_NETWORKS } from 'src/config'
import { Header } from '../header'

export default function LaunchLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <>
      <Header networks={SUPPORTED_NETWORKS} />
      <main className="flex flex-1 animate-slide flex-col">{children}</main>
    </>
  )
}
