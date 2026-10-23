import { z } from 'zod'

export const phMobile = z.string().trim().regex(/^(\+63|0)9\d{9}$/, 'Use a PH mobile number like 09171234567')

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Please enter your full name').max(80),
    email: z.string().trim().email('Enter a valid email'),
    username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/, '3–24 letters, numbers or underscores').or(z.literal('')),
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
export type RegisterForm = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})
export type LoginForm = z.infer<typeof loginSchema>

export const emailSchema = z.object({ email: z.string().trim().email('Enter a valid email') })

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
