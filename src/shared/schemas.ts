import { z } from 'zod';

export const taskInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, '请输入任务标题').max(160),
  projectId: z.string().uuid().nullable().optional(),
  notes: z.string().max(10_000).optional(),
  status: z.enum(['todo', 'in_progress', 'completed', 'cancelled']).optional(),
  plannedStart: z.iso.datetime().nullable().optional(),
  plannedEnd: z.iso.datetime().nullable().optional(),
  tagIds: z.array(z.string().uuid()).optional()
}).refine((value) => !value.plannedStart || !value.plannedEnd || new Date(value.plannedEnd) > new Date(value.plannedStart), {
  message: '结束时间必须晚于开始时间', path: ['plannedEnd']
});

export const segmentInputSchema = z.object({
  id: z.string().uuid().optional(), taskId: z.string().uuid(),
  start: z.iso.datetime(), end: z.iso.datetime().nullable().optional(),
  source: z.enum(['timer', 'manual']), note: z.string().max(2000).optional()
}).refine((value) => !value.end || new Date(value.end) > new Date(value.start), {
  message: '结束时间必须晚于开始时间', path: ['end']
});

export const calendarQuerySchema = z.object({
  start: z.iso.datetime(), end: z.iso.datetime(),
  projectIds: z.array(z.string().uuid()).optional(), tagIds: z.array(z.string().uuid()).optional(),
  statuses: z.array(z.enum(['todo', 'in_progress', 'completed', 'cancelled'])).optional(),
  search: z.string().max(200).optional(), includeDeleted: z.boolean().optional()
});
