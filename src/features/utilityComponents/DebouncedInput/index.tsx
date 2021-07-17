import React, {useCallback, useRef} from 'react'

export type DebouncedInputProps = {
  onCommitChange: (target: HTMLInputElement) => void
  onInput?: (target: HTMLInputElement) => void
  delayMs?: number
  className?: string
  type?: string
  step?: string
  placeholder?: string
}

const DebouncedInput: React.FC<DebouncedInputProps> = ({
  onCommitChange,
  onInput,
  delayMs = 2000,
  className,
  type = 'text',
  step,
  placeholder,
}) => {
  const timerRef = useRef<number>()

  const onBlur = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    onCommitChange(ev.target)
  }, [onCommitChange])

  const onChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      ev.target.blur()
    }, delayMs)
    if (onInput) {
      onInput(ev.target)
    }
  }, [delayMs, onInput])

  return (
    <input
      className={className}
      type={type}
      step={step}
      placeholder={placeholder}
      onChange={onChange}
      onBlur={onBlur}
    />
  )
}

export default DebouncedInput
