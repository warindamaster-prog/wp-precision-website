import { z } from "zod";

export const signupSchema = z.object({
  email: z.email("Enter a valid email address").max(254).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(72, "Use 72 characters or fewer"),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").max(254).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Enter your password").max(72),
});
