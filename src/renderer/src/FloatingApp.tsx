import { useEffect, useMemo, useRef, useState } from 'react'
import MihomoIcon from './components/base/mihomo-icon'
import { calcTraffic } from './utils/calc'
import { showContextMenu, triggerMainWindow } from './utils/ipc'
import { useAppConfig } from './hooks/use-app-config'
import { useControledMihomoConfig } from './hooks/use-controled-mihomo-config'

const TRAFFIC_UPDATE_INTERVAL = 250

const FloatingApp: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { sysProxy, spinFloatingIcon = true, disableAnimation = true } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const sysProxyEnabled = sysProxy?.enable
  const tunEnabled = tun?.enable

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  const trafficTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTrafficRef = useRef<ControllerTraffic | null>(null)

  const spinDuration = useMemo(() => {
    if (!spinFloatingIcon || disableAnimation) return null

    const total = upload + download
    if (total === 0) return null
    if (total < 1024) return 2.8
    if (total < 1024 * 1024) return 2.2
    if (total < 1024 * 1024 * 1024) return 1.6
    return 1.2
  }, [disableAnimation, download, spinFloatingIcon, upload])

  const floatingThumbStyle = useMemo(() => {
    if (!spinDuration) return undefined
    return {
      animation: `spin ${spinDuration}s linear infinite`,
      willChange: 'transform' as const
    }
  }, [spinDuration])

  useEffect(() => {
    const flushTraffic = (): void => {
      const info = latestTrafficRef.current
      trafficTimerRef.current = null
      latestTrafficRef.current = null
      if (!info) return
      setUpload((prev) => (prev === info.up ? prev : info.up))
      setDownload((prev) => (prev === info.down ? prev : info.down))
    }

    const handleTraffic = (_e: unknown, info: ControllerTraffic): void => {
      latestTrafficRef.current = info
      if (trafficTimerRef.current) return
      trafficTimerRef.current = setTimeout(flushTraffic, TRAFFIC_UPDATE_INTERVAL)
    }

    window.electron.ipcRenderer.on('mihomoTraffic', handleTraffic)
    return (): void => {
      window.electron.ipcRenderer.removeListener('mihomoTraffic', handleTraffic)
      if (trafficTimerRef.current) {
        clearTimeout(trafficTimerRef.current)
      }
      trafficTimerRef.current = null
      latestTrafficRef.current = null
    }
  }, [])

  return (
    <div className="app-drag h-screen w-screen overflow-hidden">
      <div className="floating-bg border border-divider flex rounded-full bg-content1 h-[calc(100%-2px)] w-[calc(100%-2px)]">
        <div className="flex justify-center items-center h-full aspect-square">
          <div
            onContextMenu={(e) => {
              e.preventDefault()
              showContextMenu()
            }}
            onClick={() => {
              triggerMainWindow()
            }}
            style={floatingThumbStyle}
            className={`app-nodrag cursor-pointer floating-thumb ${tunEnabled ? 'bg-secondary' : sysProxyEnabled ? 'bg-primary' : 'bg-default'} hover:opacity-hover rounded-full h-[calc(100%-4px)] aspect-square`}
          >
            <MihomoIcon className="floating-icon text-primary-foreground h-full leading-full text-[22px] mx-auto" />
          </div>
        </div>
        <div className="w-full overflow-hidden">
          <div className="flex flex-col justify-center h-full w-full">
            <h2 className="text-end floating-text whitespace-nowrap text-[12px] mr-2 font-bold">
              {calcTraffic(upload)}/s
            </h2>
            <h2 className="text-end floating-text whitespace-nowrap text-[12px] mr-2 font-bold">
              {calcTraffic(download)}/s
            </h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FloatingApp
