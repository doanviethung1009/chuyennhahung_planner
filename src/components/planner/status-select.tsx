'use client';

import { useTranslations } from 'next-intl';
import type { PlanningStatus } from '@/server/planner/schemas';
import { inputClass } from './field';

export const PLANNING_STATUSES: PlanningStatus[] = ['draft', 'planned', 'completed'];

export function StatusSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: PlanningStatus;
  disabled?: boolean;
  onChange: (next: PlanningStatus) => void;
}) {
  const t = useTranslations('planning');
  return (
    <select
      id={id}
      className={`${inputClass} sm:w-auto`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as PlanningStatus)}
    >
      {PLANNING_STATUSES.map((status) => (
        <option key={status} value={status}>
          {t(status)}
        </option>
      ))}
    </select>
  );
}
