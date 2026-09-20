import { useId } from "react"
import { Switch } from "@/components/ui/switch"

export function SettingRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  description?: React.ReactNode
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <label htmlFor={id} className="space-y-0.5 text-sm">
        <span className="block">{label}</span>
        {description && (
          <span className="block text-xs text-pretty text-graphite tabular-nums">
            {description}
          </span>
        )}
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
    </div>
  )
}
