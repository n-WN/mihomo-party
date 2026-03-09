import React, { useRef } from 'react'
import { Input, InputProps } from '@heroui/react'
import { FaSearch } from 'react-icons/fa'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface CollapseInputProps extends InputProps {
  title: string
}

const CollapseInput: React.FC<CollapseInputProps> = (props) => {
  const { title, ...inputProps } = props
  const { appConfig } = useAppConfig()
  const { disableAnimation = true } = appConfig || {}
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex">
      <Input
        size="sm"
        ref={inputRef}
        {...inputProps}
        style={{ paddingInlineEnd: 0 }}
        classNames={{
          inputWrapper: 'cursor-pointer bg-transparent p-0 data-[hover=true]:bg-content2',
          input: `w-0 focus:w-[150px] focus:ml-2 ${disableAnimation ? '' : 'transition-all duration-150'}`
        }}
        endContent={
          <div
            className="cursor-pointer p-2 text-lg text-foreground-500"
            onClick={(e) => {
              e.stopPropagation()
              if (inputRef.current?.offsetWidth != 0) {
                inputRef.current?.blur()
              } else {
                inputRef.current?.focus()
              }
            }}
          >
            <FaSearch title={title} />
          </div>
        }
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.focus()
        }}
      />
    </div>
  )
}

export default CollapseInput
