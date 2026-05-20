import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { HelpDrawer } from './HelpDrawer';
import { cn } from '@/lib/utils';
import type { HelpTopic } from './HelpDrawer';

interface HelpButtonProps {
  topic: HelpTopic;
  className?: string;
}

export function HelpButton({ topic, className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<HelpTopic>(topic);

  return (
    <>
      <button
        onClick={() => { setCurrentTopic(topic); setOpen(true); }}
        title="Ayuda"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
          'text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50',
          className
        )}
      >
        <HelpCircle size={13} />
        <span>Ayuda</span>
      </button>

      {open && (
        <HelpDrawer
          topic={currentTopic}
          onClose={() => setOpen(false)}
          onChangeTopic={t => setCurrentTopic(t)}
        />
      )}
    </>
  );
}
