import { MoonStar } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ResumeInfo { suspendedAt: string; resumedAt: string }

export function SleepReconcileDialog({ info, onClose }: { info: ResumeInfo; onClose(): void }) {
  const { data, saveSegment } = useAppStore();
  const active = data.segments.filter((segment) => !segment.end && !segment.deletedAt);
  const minutes = Math.max(1, Math.round((new Date(info.resumedAt).getTime() - new Date(info.suspendedAt).getTime()) / 60_000));
  const subtract = async () => {
    for (const segment of active) {
      await saveSegment({ ...segment, end: info.suspendedAt });
      await saveSegment({ taskId: segment.taskId, start: info.resumedAt, end: null, source: 'timer', note: '系统休眠后继续' });
    }
    onClose();
  };
  return <div className="modal-backdrop"><div className="sleep-dialog" role="dialog" aria-modal="true" aria-labelledby="sleep-title"><MoonStar size={24} /><p className="eyebrow">WELCOME BACK</p><h2 id="sleep-title">电脑休眠了约 {minutes} 分钟</h2><p>休眠期间有 {active.length} 个任务保持计时。是否从实际工作时间中扣除这段间隔？</p><div><button className="secondary-button" onClick={onClose}>保留这段时间</button><button className="primary-button" onClick={subtract}>扣除休眠时间</button></div></div></div>;
}
