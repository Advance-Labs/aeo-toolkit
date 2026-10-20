import type { FindingSeverity } from '@advance-labs/types';

export function severityChipClasses(severity: FindingSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/12 text-red-300 border-red-400/30';
    case 'high':
      return 'bg-orange-500/12 text-orange-300 border-orange-400/30';
    case 'medium':
      return 'bg-amber-500/12 text-amber-300 border-amber-400/30';
    case 'low':
      return 'bg-cyan-500/12 text-cyan-300 border-cyan-400/30';
    case 'info':
      return 'bg-white/5 text-slate-300 border-white/15';
  }
}

export function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    case 'info':
      return 4;
  }
}
