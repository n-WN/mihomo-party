import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import { useEffect, useMemo, useState } from 'react'
import { Button, Divider, Input } from '@heroui/react'
import { Virtuoso } from 'react-virtuoso'
import { IoLocationSharp } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'

import { includesIgnoreCase } from '@renderer/utils/includes'

const MAX_LOGS = 500

const cachedLogs: {
  log: ControllerLog[]
  trigger: ((i: ControllerLog[]) => void) | null
  clean: () => void
  append: (items: ControllerLog[]) => void
} = {
  log: [],
  trigger: null,
  clean(): void {
    this.log = []
    if (this.trigger !== null) {
      this.trigger(this.log)
    }
  },
  append(items: ControllerLog[]): void {
    if (items.length === 0) return
    const nextItems = items.map((item) => ({
      ...item,
      time: new Date().toLocaleString()
    }))
    this.log = [...this.log, ...nextItems].slice(-MAX_LOGS)
    if (this.trigger !== null) {
      this.trigger(this.log)
    }
  }
}

window.electron.ipcRenderer.on('mihomoLogs', (_e, logs: ControllerLog[]) => {
  cachedLogs.append(logs)
})

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<ControllerLog[]>(cachedLogs.log)
  const [filter, setFilter] = useState('')
  const [trace, setTrace] = useState(true)

  const filteredLogs = useMemo(() => {
    if (filter === '') return logs
    return logs.filter((log) => {
      return includesIgnoreCase(log.payload, filter) || includesIgnoreCase(log.type, filter)
    })
  }, [logs, filter])

  useEffect(() => {
    const old = cachedLogs.trigger
    cachedLogs.trigger = (items): void => {
      setLogs([...items])
    }
    return (): void => {
      cachedLogs.trigger = old
    }
  }, [])

  return (
    <BasePage title="实时日志">
      <div className="sticky top-0 z-40">
        <div className="w-full flex p-2">
          <Input
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />
          <Button
            size="sm"
            isIconOnly
            className="ml-2"
            color={trace ? 'primary' : 'default'}
            variant={trace ? 'solid' : 'bordered'}
            onPress={() => {
              setTrace((prev) => !prev)
            }}
          >
            <IoLocationSharp className="text-lg" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            title="清空日志"
            className="ml-2"
            variant="light"
            color="danger"
            onPress={() => {
              cachedLogs.clean()
            }}
          >
            <CgTrash className="text-lg" />
          </Button>
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-px">
        <Virtuoso
          data={filteredLogs}
          initialTopMostItemIndex={filteredLogs.length - 1}
          followOutput={trace}
          itemContent={(i, log) => {
            return (
              <LogItem
                index={i}
                key={log.payload + i}
                time={log.time}
                type={log.type}
                payload={log.payload}
              />
            )
          }}
        />
      </div>
    </BasePage>
  )
}

export default Logs
