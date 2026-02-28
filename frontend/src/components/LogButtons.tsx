import LogHealthDialog from '@/components/LogHealthDialog'
import LogInsulinDialog from '@/components/LogInsulinDialog'
import LogMealDialog from '@/components/LogMealDialog'

interface Props {
  onSuccess: () => void
}

export default function LogButtons({ onSuccess }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <LogMealDialog onSuccess={onSuccess} />
      <LogInsulinDialog onSuccess={onSuccess} />
      <LogHealthDialog onSuccess={onSuccess} />
    </div>
  )
}
