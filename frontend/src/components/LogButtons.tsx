import LogHealthDialog from '@/components/LogHealthDialog'
import LogInsulinDialog from '@/components/LogInsulinDialog'
import LogMealInsulinDialog from '@/components/LogMealInsulinDialog'

interface Props {
  onSuccess: () => void
}

export default function LogButtons({ onSuccess }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <LogMealInsulinDialog onSuccess={onSuccess} />
      <LogInsulinDialog onSuccess={onSuccess} />
      <LogHealthDialog onSuccess={onSuccess} />
    </div>
  )
}
