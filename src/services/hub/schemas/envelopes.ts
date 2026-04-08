import { z } from 'zod';

export const HubErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
});

type HubEnvelopeSchema<TData extends z.ZodTypeAny> = z.ZodObject<{
  ok: z.ZodBoolean;
  data: z.ZodNullable<TData>;
  error: z.ZodNullable<typeof HubErrorPayloadSchema>;
}>;

export const createHubEnvelopeSchema = <TData extends z.ZodTypeAny>(dataSchema: TData): HubEnvelopeSchema<TData> =>
  z.object({
    ok: z.boolean(),
    data: dataSchema.nullable(),
    error: HubErrorPayloadSchema.nullable(),
  });

export const HubEnvelopeUnknownSchema = createHubEnvelopeSchema(z.unknown());

export const HubEnvelopeRecordSchema = createHubEnvelopeSchema(z.record(z.string(), z.unknown()));

export const LegacyRecordResponseSchema = z.object({
  error: z.string().optional(),
}).catchall(z.unknown());

export type HubEnvelopeUnknown = z.infer<typeof HubEnvelopeUnknownSchema>;
export type HubEnvelopeRecord = z.infer<typeof HubEnvelopeRecordSchema>;
export type LegacyRecordResponse = z.infer<typeof LegacyRecordResponseSchema>;
