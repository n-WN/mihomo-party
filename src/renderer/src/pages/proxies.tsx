import { Avatar, Button, Card, CardBody, Chip } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getImageDataURL,
  mihomoChangeProxy,
  mihomoCloseConnections,
  mihomoProxyDelay
} from '@renderer/utils/ipc'
import { FaLocationCrosshairs } from 'react-icons/fa6'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { IoIosArrowBack } from 'react-icons/io'
import { MdDoubleArrow, MdOutlineSpeed, MdTune } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'
import CollapseInput from '@renderer/components/base/collapse-input'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

const resizeStateArray = <T,>(prev: T[], length: number, fallback: T): T[] => {
  const next = prev.slice(0, length)
  while (next.length < length) {
    next.push(fallback)
  }
  return next
}

const Proxies: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups = [], mutate } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    groupDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    closeMode = 'all',
    proxyCols = 'auto',
    delayTestUrlScope = 'group',
    delayTestConcurrency = 50,
    disableAnimation = true
  } = appConfig || {}
  const [cols, setCols] = useState(1)
  const [isOpen, setIsOpen] = useState(Array(groups.length).fill(false))
  const [delaying, setDelaying] = useState(Array(groups.length).fill(false))
  const [searchValue, setSearchValue] = useState(Array(groups.length).fill(''))
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [groupIconMap, setGroupIconMap] = useState<Record<string, string>>({})
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const groupIconLoading = useRef(new Set<string>())
  const resizeFrameRef = useRef<number | null>(null)
  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: (ControllerProxiesDetail | ControllerGroupDetail)[][] = []
    groups.forEach((group, index) => {
      if (isOpen[index]) {
        let groupProxies = group.all.filter(
          (proxy) => proxy && includesIgnoreCase(proxy.name, searchValue[index])
        )
        const count = Math.floor(groupProxies.length / cols)
        groupCounts.push(groupProxies.length % cols === 0 ? count : count + 1)
        if (proxyDisplayOrder === 'delay') {
          groupProxies = groupProxies.sort((a, b) => {
            if (a.history.length === 0) return -1
            if (b.history.length === 0) return 1
            if (a.history[a.history.length - 1].delay === 0) return 1
            if (b.history[b.history.length - 1].delay === 0) return -1
            return a.history[a.history.length - 1].delay - b.history[b.history.length - 1].delay
          })
        }
        if (proxyDisplayOrder === 'name') {
          groupProxies = groupProxies.sort((a, b) => a.name.localeCompare(b.name))
        }
        allProxies.push(groupProxies)
      } else {
        groupCounts.push(0)
        allProxies.push([])
      }
    })
    return { groupCounts, allProxies }
  }, [groups, isOpen, proxyDisplayOrder, cols, searchValue])

  useEffect(() => {
    setIsOpen((prev) => resizeStateArray(prev, groups.length, false))
    setDelaying((prev) => resizeStateArray(prev, groups.length, false))
    setSearchValue((prev) => resizeStateArray(prev, groups.length, ''))
  }, [groups.length])

  useEffect(() => {
    let cancelled = false
    const remoteIcons = groups
      .map((group) => group.icon)
      .filter((icon): icon is string => Boolean(icon && icon.startsWith('http')))

    const loadIcons = async (): Promise<void> => {
      for (const icon of remoteIcons) {
        if (cancelled || groupIconLoading.current.has(icon) || groupIconMap[icon]) continue

        const cached = localStorage.getItem(icon)
        if (cached) {
          setGroupIconMap((prev) => (prev[icon] === cached ? prev : { ...prev, [icon]: cached }))
          continue
        }

        groupIconLoading.current.add(icon)
        try {
          const dataURL = await getImageDataURL(icon)
          if (cancelled || !dataURL) continue
          localStorage.setItem(icon, dataURL)
          setGroupIconMap((prev) => (prev[icon] === dataURL ? prev : { ...prev, [icon]: dataURL }))
        } catch {
          // ignore
        } finally {
          groupIconLoading.current.delete(icon)
        }
      }
    }

    void loadIcons()

    return (): void => {
      cancelled = true
    }
  }, [groupIconMap, groups])

  const onChangeProxy = useCallback(
    async (group: string, proxy: string): Promise<void> => {
      await mihomoChangeProxy(group, proxy)
      if (autoCloseConnection) {
        if (closeMode === 'all') {
          await mihomoCloseConnections()
        } else if (closeMode === 'group') {
          await mihomoCloseConnections(group)
        }
      }
      mutate()
    },
    [autoCloseConnection, closeMode, mutate]
  )

  const getDelayTestUrl = useCallback(
    (group?: ControllerMixedGroup): string | undefined => {
      if (delayTestUrlScope === 'global') return undefined
      return group?.testUrl
    },
    [delayTestUrlScope]
  )

  const onProxyDelay = useCallback(
    async (proxy: string, group?: ControllerMixedGroup): Promise<ControllerProxiesDelay> => {
      return await mihomoProxyDelay(proxy, getDelayTestUrl(group))
    },
    [getDelayTestUrl]
  )

  const onGroupDelay = useCallback(
    async (index: number): Promise<void> => {
      const targetGroup = groups[index]
      if (!targetGroup) return

      const fallbackProxies = targetGroup.all.filter(
        (proxy) => proxy && includesIgnoreCase(proxy.name, searchValue[index] || '')
      )
      const targetProxies = allProxies[index].length > 0 ? allProxies[index] : fallbackProxies

      if (!isOpen[index]) {
        setIsOpen((prev) => {
          const newOpen = [...prev]
          newOpen[index] = true
          return newOpen
        })
      }

      setDelaying((prev) => {
        const newDelaying = [...prev]
        newDelaying[index] = true
        return newDelaying
      })

      try {
        const result: Promise<void>[] = []
        const runningList: Promise<void>[] = []

        for (const proxy of targetProxies) {
          const promise = Promise.resolve().then(async () => {
            try {
              await mihomoProxyDelay(proxy.name, getDelayTestUrl(targetGroup))
            } catch {
              // ignore
            }
          })
          result.push(promise)
          const running = promise.then(() => {
            runningList.splice(runningList.indexOf(running), 1)
          })
          runningList.push(running)
          if (runningList.length >= (delayTestConcurrency || 50)) {
            await Promise.race(runningList)
          }
        }

        await Promise.all(result)
        mutate()
      } finally {
        setDelaying((prev) => {
          const newDelaying = [...prev]
          newDelaying[index] = false
          return newDelaying
        })
      }
    },
    [allProxies, delayTestConcurrency, getDelayTestUrl, groups, isOpen, mutate, searchValue]
  )

  const calcCols = useCallback((): number => {
    if (window.matchMedia('(min-width: 1536px)').matches) {
      return 5
    } else if (window.matchMedia('(min-width: 1280px)').matches) {
      return 4
    } else if (window.matchMedia('(min-width: 1024px)').matches) {
      return 3
    } else {
      return 2
    }
  }, [])

  const toggleOpen = useCallback((index: number) => {
    setIsOpen((prev) => {
      const newOpen = [...prev]
      newOpen[index] = !prev[index]
      return newOpen
    })
  }, [])

  const updateSearchValue = useCallback((index: number, value: string) => {
    setSearchValue((prev) => {
      const newSearchValue = [...prev]
      newSearchValue[index] = value
      return newSearchValue
    })
  }, [])

  const scrollToCurrentProxy = useCallback(
    (index: number) => {
      if (!isOpen[index]) {
        setIsOpen((prev) => {
          const newOpen = [...prev]
          newOpen[index] = true
          return newOpen
        })
      }
      let i = 0
      for (let j = 0; j < index; j++) {
        i += groupCounts[j]
      }
      i += Math.floor(
        allProxies[index].findIndex((proxy) => proxy.name === groups[index].now) / cols
      )
      virtuosoRef.current?.scrollToIndex({
        index: Math.floor(i),
        align: 'start'
      })
    },
    [isOpen, groupCounts, allProxies, groups, cols]
  )

  useEffect(() => {
    if (proxyCols !== 'auto') {
      setCols(parseInt(proxyCols))
      return
    }

    setCols(calcCols())
    const handleResize = (): void => {
      if (resizeFrameRef.current !== null) return
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null
        setCols((prev) => {
          const next = calcCols()
          return prev === next ? prev : next
        })
      })
    }

    window.addEventListener('resize', handleResize)
    return (): void => {
      window.removeEventListener('resize', handleResize)
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
    }
  }, [proxyCols, calcCols])

  const groupContent = useCallback(
    (index: number) => {
      return groups[index] ? (
        <div
          className={`w-full pt-2 ${index === groupCounts.length - 1 && !isOpen[index] ? 'pb-2' : ''} px-2`}
        >
          <Card as="div" isPressable fullWidth onPress={() => toggleOpen(index)}>
            <CardBody className="w-full h-14">
              <div className="flex justify-between h-full">
                <div className="flex text-ellipsis overflow-hidden whitespace-nowrap h-full">
                  {groups[index].icon ? (
                    <Avatar
                      className="bg-transparent mr-2 w-8 h-8"
                      size="sm"
                      radius="sm"
                      src={
                        groups[index].icon.startsWith('<svg')
                          ? `data:image/svg+xml;utf8,${groups[index].icon}`
                          : groupIconMap[groups[index].icon] || groups[index].icon
                      }
                    />
                  ) : null}
                  <div
                    className={`flex flex-col h-full ${groupDisplayLayout === 'double' ? '' : 'justify-center'}`}
                  >
                    <div
                      className={`text-ellipsis overflow-hidden whitespace-nowrap leading-tight ${groupDisplayLayout === 'double' ? 'text-md flex-5 flex items-center' : 'text-lg'}`}
                    >
                      <span className="flag-emoji inline-block">{groups[index].name}</span>
                      {groupDisplayLayout === 'single' && (
                        <>
                          <div
                            title={groups[index].type}
                            className="inline ml-2 text-sm text-foreground-500"
                          >
                            {groups[index].type}
                          </div>
                          <div className="inline flag-emoji ml-2 text-sm text-foreground-500">
                            {groups[index].now}
                          </div>
                        </>
                      )}
                    </div>
                    {groupDisplayLayout === 'double' && (
                      <div className="text-ellipsis whitespace-nowrap text-[10px] text-foreground-500 leading-tight flex-3 flex items-center">
                        <span>{groups[index].type}</span>
                        <span className="flag-emoji ml-1 inline-block">{groups[index].now}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <Chip size="sm" className="my-1 mr-2">
                      {groups[index].all.length}
                    </Chip>
                    <CollapseInput
                      title="搜索节点"
                      value={searchValue[index]}
                      onValueChange={(v) => updateSearchValue(index, v)}
                    />
                    <Button
                      title="定位到当前节点"
                      variant="light"
                      size="sm"
                      isIconOnly
                      onPress={() => scrollToCurrentProxy(index)}
                    >
                      <FaLocationCrosshairs className="text-lg text-foreground-500" />
                    </Button>
                    <Button
                      title="延迟测试"
                      variant="light"
                      isLoading={delaying[index]}
                      size="sm"
                      isIconOnly
                      onPress={() => onGroupDelay(index)}
                    >
                      <MdOutlineSpeed className="text-lg text-foreground-500" />
                    </Button>
                  </div>
                  <IoIosArrowBack
                    className={`${disableAnimation ? '' : 'transition duration-150'} ml-2 h-[32px] text-lg text-foreground-500 flex items-center ${isOpen[index] ? '-rotate-90' : ''}`}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div>Never See This</div>
      )
    },
    [
      groups,
      groupCounts,
      isOpen,
      groupDisplayLayout,
      searchValue,
      delaying,
      toggleOpen,
      updateSearchValue,
      scrollToCurrentProxy,
      onGroupDelay,
      groupIconMap
    ]
  )

  const itemContent = useCallback(
    (index: number, groupIndex: number) => {
      let innerIndex = index
      groupCounts.slice(0, groupIndex).forEach((count) => {
        innerIndex -= count
      })
      return allProxies[groupIndex] ? (
        <div
          style={
            proxyCols !== 'auto'
              ? { gridTemplateColumns: `repeat(${proxyCols}, minmax(0, 1fr))` }
              : {}
          }
          className={`grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} ${groupIndex === groupCounts.length - 1 && innerIndex === groupCounts[groupIndex] - 1 ? 'pb-2' : ''} gap-2 pt-2 mx-2`}
        >
          {Array.from({ length: cols }).map((_, i) => {
            if (!allProxies[groupIndex][innerIndex * cols + i]) return null
            return (
              <ProxyItem
                key={allProxies[groupIndex][innerIndex * cols + i].name}
                mutateProxies={mutate}
                onProxyDelay={onProxyDelay}
                onSelect={onChangeProxy}
                proxy={allProxies[groupIndex][innerIndex * cols + i]}
                group={groups[groupIndex]}
                proxyDisplayLayout={proxyDisplayLayout}
                selected={
                  allProxies[groupIndex][innerIndex * cols + i]?.name === groups[groupIndex].now
                }
              />
            )
          })}
        </div>
      ) : (
        <div>Never See This</div>
      )
    },
    [
      groupCounts,
      allProxies,
      proxyCols,
      cols,
      mutate,
      onProxyDelay,
      onChangeProxy,
      groups,
      proxyDisplayLayout
    ]
  )

  return (
    <BasePage
      title="代理组"
      header={
        <Button
          size="sm"
          isIconOnly
          variant="light"
          className="app-nodrag"
          title="代理组设置"
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-lg" />
        </Button>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {mode === 'direct' ? (
        <div className="h-full w-full flex justify-center items-center">
          <div className="flex flex-col items-center">
            <MdDoubleArrow className="text-foreground-500 text-[100px]" />
            <h2 className="text-foreground-500 text-[20px]">直连模式</h2>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <GroupedVirtuoso
            ref={virtuosoRef}
            groupCounts={groupCounts}
            groupContent={groupContent}
            itemContent={itemContent}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
