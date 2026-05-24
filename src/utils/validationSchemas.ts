import { z } from 'zod';

// ============================================================
// FE1 - Validacija unosa | Developer: Marta Suljagic
// Validacione šeme za Banka 2025 - Celina 1
// ============================================================

export const emailSchema = z
  .string()
  .min(1, 'Email je obavezan')
  .email('Unesite validan email format');

export const passwordSchema = z
  .string()
  .min(8, 'Lozinka mora imati najmanje 8 karaktera')
  .max(32, 'Lozinka može imati najviše 32 karaktera')
  .refine((val) => (val.match(/[0-9]/g) || []).length >= 2, {
    message: 'Lozinka mora sadržati najmanje 2 broja',
  })
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Lozinka mora sadržati najmanje 1 veliko slovo',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'Lozinka mora sadržati najmanje 1 malo slovo',
  });

// FE1: Ojačana validacija telefona - E.164 kompatibilan format
// FE1: Strict E.164 — samo brojevi (opciono vodeci '+'), 6-15 cifara.
// UI mora normalize-ovati input (strip razmaka/crtica) pre nego sto stigne ovde.
export const phoneSchema = z
  .string()
  .min(1, 'Broj telefona je obavezan')
  .regex(/^\+?[0-9]{6,15}$/, 'Unesite validan broj telefona (samo brojevi sa opcionim "+", 6-15 cifara)');

// FE1: Validacija datuma rođenja - mora biti STROGO u prošlosti (today odbacen).
// Parsiramo i `val` i `today` kao naked "YYYY-MM-DD" da izbegnemo timezone
// nesporazum: new Date("2026-05-24") = 00:00 UTC, dok new Date() ima lokalno
// vreme — direktno poredjenje propusti today kao "manji". Resenje: oba kraja
// normalizujemo na pocetak dana u istoj UTC zoni.
export const birthDateSchema = z
  .string()
  .min(1, 'Datum rođenja je obavezan')
  .refine(
    (val) => {
      try {
        const date = new Date(val);
        if (isNaN(date.getTime())) return false;
        const today = new Date();
        const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        return date.getTime() < todayUtc;
      } catch {
        return false;
      }
    },
    { message: 'Datum rođenja mora biti u prošlosti' }
  );

export const nameSchema = z
  .string()
  .min(1, 'Ovo polje je obavezno')
  .max(100, 'Maksimalno 100 karaktera');

// Login forma
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Lozinka je obavezna'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

// Kreiranje zaposlenog (FE1: ojačane validacije)
export const createEmployeeSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  username: z.string().min(1, 'Username je obavezan'),
  email: emailSchema,
  position: z.string().min(1, 'Pozicija je obavezna'),
  phoneNumber: phoneSchema,
  isActive: z.boolean(),
  address: z.string().min(1, 'Adresa je obavezna'),
  dateOfBirth: birthDateSchema,
  gender: z.string().min(1, 'Pol je obavezan'),
  department: z.string().min(1, 'Odeljenje je obavezno'),
});
export type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

// Editovanje zaposlenog (FE1: ojačane validacije)
export const editEmployeeSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  position: z.string().min(1, 'Pozicija je obavezna'),
  phoneNumber: phoneSchema,
  isActive: z.boolean(),
  address: z.string().min(1, 'Adresa je obavezna'),
  dateOfBirth: birthDateSchema,
  gender: z.string().min(1, 'Pol je obavezan'),
  department: z.string().min(1, 'Odeljenje je obavezno'),
});
export type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;

// Aktivacija naloga
export const activateAccountSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Potvrdite lozinku'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Lozinke se ne poklapaju',
    path: ['confirmPassword'],
  });
export type ActivateAccountFormData = z.infer<typeof activateAccountSchema>;

// Forgot password
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// Reset password
export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Potvrdite lozinku'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Lozinke se ne poklapaju',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
