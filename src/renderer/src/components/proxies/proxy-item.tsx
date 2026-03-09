import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useCallback, useState } from 'react'
import { FaMapPin } from 'react-icons/fa6'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (proxy: string, group?: ControllerMixedGroup) => Promise<ControllerProxiesDelay>
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
  proxy: ControllerProxiesDetail | ControllerGroupDetail
  group: ControllerMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
}

const getProxyDelayValue = (proxy: ControllerProxiesDetail | ControllerGroupDetail): number => {
  if (proxy.history.length > 0) {
    return proxy.history[proxy.history.length - 1].delay
  }
  return -1
}

const ProxyItemComponent: React.FC<Props> = (props) => {
  const { mutateProxies, proxyDisplayLayout, group, proxy, selected, onSelect, onProxyDelay } =
    props

  const delay = getProxyDelayValue(proxy)
  const [loading, setLoading] = useState(false)

  const delayColor = (nextDelay: number): 'primary' | 'success' | 'warning' | 'danger' => {
    if (nextDelay === -1) return 'primary'
    if (nextDelay === 0) return 'danger'
    if (nextDelay < 500) return 'success'
    return 'warning'
  }

  const delayText = (nextDelay: number): string => {
    if (nextDelay === -1) return '测试'
    if (nextDelay === 0) return '超时'
    return nextDelay.toString()
  }

  const handleDelay = useCallback((): void => {
    setLoading(true)
    onProxyDelay(proxy.name, group).finally(() => {
      mutateProxies()
      setLoading(false)
    })
  }, [group, mutateProxies, onProxyDelay, proxy.name])

  const handleUnfix = useCallback(async (): Promise<void> => {
    await mihomoUnfixedProxy(group.name)
    mutateProxies()
  }, [group.name, mutateProxies])

  const fixed = group.fixed && group.fixed === proxy.name

  return (
    <Card
      as="div"
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="sm"
      className={`${fixed ? 'bg-secondary/30' : selected ? 'bg-primary/30' : 'bg-content2'}`}
      radius="sm"
    >
      <CardBody className="py-1.5 px-2">
        <div
          className={`flex ${proxyDisplayLayout === 'double' ? 'gap-1' : 'justify-between items-center'}`}
        >
          {proxyDisplayLayout === 'double' ? (
            <>
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                  <div className="flag-emoji inline" title={proxy.name}>
                    {proxy.name}
                  </div>
                </div>
                <div className="text-[12px] text-foreground-500 leading-none mt-0.5">
                  <span>{proxy.type}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-0.5 shrink-0">
                {fixed && (
                  <Button
                    isIconOnly
                    title="取消固定"
                    color="danger"
                    onPress={handleUnfix}
                    variant="light"
                    className="h-[24px] w-[24px] min-w-[24px] p-0 text-xs"
                  >
                    <FaMapPin className="text-xs le" />
                  </Button>
                )}
                <Button
                  isIconOnly
                  title={proxy.type}
                  isLoading={loading}
                  color={delayColor(delay)}
                  onPress={handleDelay}
                  variant="light"
                  className="h-[32px] w-[32px] min-w-[32px] p-0 text-xs"
                >
                  {delayText(delay)}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                <div className="flag-emoji inline" title={proxy.name}>
                  {proxy.name}
                </div>
                {proxyDisplayLayout === 'single' && (
                  <div className="inline ml-2 text-foreground-500" title={proxy.type}>
                    {proxy.type}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {fixed && (
                  <div className="flex items-center">
                    <Button
                      isIconOnly
                      title="取消固定"
                      color="danger"
                      onPress={handleUnfix}
                      variant="light"
                      className="h-[24px] w-[24px] min-w-[24px] p-0 text-xs"
                    >
                      <FaMapPin className="text-xs le" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center">
                  <Button
                    isIconOnly
                    title={proxy.type}
                    isLoading={loading}
                    color={delayColor(delay)}
                    onPress={handleDelay}
                    variant="light"
                    className="h-full w-[32px] min-w-[32px] p-0 text-sm"
                  >
                    {delayText(delay)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

const ProxyItem = React.memo(ProxyItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.selected === nextProps.selected &&
    prevProps.proxyDisplayLayout === nextProps.proxyDisplayLayout &&
    prevProps.proxy.name === nextProps.proxy.name &&
    prevProps.proxy.type === nextProps.proxy.type &&
    getProxyDelayValue(prevProps.proxy) === getProxyDelayValue(nextProps.proxy) &&
    prevProps.group.name === nextProps.group.name &&
    prevProps.group.now === nextProps.group.now &&
    prevProps.group.fixed === nextProps.group.fixed
  )
})

export default ProxyItem
