import { z } from 'zod';

export const sleepSchema = z.object({
  bedtime: z.union([z.string(), z.date()])
    .transform((val) => typeof val === 'string' ? val : val.toISOString())
    .refine((val) => !isNaN(Date.parse(val)), {
      message: '有効な就寝時刻を入力してください。',
    }),
  wake_time: z.union([z.string(), z.date()])
    .transform((val) => typeof val === 'string' ? val : val.toISOString())
    .refine((val) => !isNaN(Date.parse(val)), {
      message: '有効な起床時刻を入力してください。',
    }),
  memo: z.string()
    .max(100, 'メモは100文字以内で入力してください。')
    .optional()
    .nullable()
    .transform(val => val === '' ? null : val),
}).superRefine((data, ctx) => {
  const bed = new Date(data.bedtime);
  const wake = new Date(data.wake_time);

  if (isNaN(bed.getTime()) || isNaN(wake.getTime())) {
    return;
  }

  // 1. wake_time must be after bedtime
  if (wake.getTime() <= bed.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '起床時刻は就寝時刻より後の時間である必要があります。',
      path: ['wake_time'],
    });
  }

  // 2. duration must not exceed 24 hours
  const diffInMs = wake.getTime() - bed.getTime();
  const maxDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  if (diffInMs > maxDurationMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '睡眠時間は24時間以内である必要があります。',
      path: ['wake_time'],
    });
  }
});

export type SleepLogInput = z.infer<typeof sleepSchema>;
