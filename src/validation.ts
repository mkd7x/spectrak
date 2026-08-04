import { z } from "zod";

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// spec: SPK-ERROR-001
export const uuidV4Schema = z
  .string()
  .regex(uuidV4Pattern, "Must be a valid UUID v4");

export const specPayloadSchema = z.object({
  uuid: uuidV4Schema,
  title: z.string().optional(),
  content: z.string(),
});

export const resolvePayloadSchema = z.object({
  content: z.string(),
});

export type SpecPayload = z.infer<typeof specPayloadSchema>;
