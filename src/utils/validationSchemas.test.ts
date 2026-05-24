import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  nameSchema,
  birthDateSchema,
  loginSchema,
  createEmployeeSchema,
  editEmployeeSchema,
  activateAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validationSchemas';

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.safeParse('test@banka.rs').success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a valid password', () => {
    expect(passwordSchema.safeParse('Admin12345').success).toBe(true);
  });

  it('rejects password shorter than 8 chars', () => {
    expect(passwordSchema.safeParse('Ab12').success).toBe(false);
  });

  it('rejects password longer than 32 chars', () => {
    const longPwd = 'Aa12' + 'x'.repeat(30);
    expect(passwordSchema.safeParse(longPwd).success).toBe(false);
  });

  it('rejects password without 2 digits', () => {
    expect(passwordSchema.safeParse('Abcdefgh1').success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    expect(passwordSchema.safeParse('abcdefgh12').success).toBe(false);
  });

  it('rejects password without lowercase', () => {
    expect(passwordSchema.safeParse('ABCDEFGH12').success).toBe(false);
  });

  it('accepts password at exactly 8 chars', () => {
    expect(passwordSchema.safeParse('Abcdef12').success).toBe(true);
  });

  it('accepts password at exactly 32 chars', () => {
    const pwd = 'Ab12' + 'x'.repeat(28);
    expect(passwordSchema.safeParse(pwd).success).toBe(true);
  });
});

describe('phoneSchema (FE1 - E.164 format)', () => {
  it('accepts valid phone with + prefix and exactly 6 digits', () => {
    expect(phoneSchema.safeParse('+381641').success).toBe(true);
  });

  it('accepts valid phone with + prefix and 15 digits', () => {
    expect(phoneSchema.safeParse('+381641234567890').success).toBe(true);
  });

  it('accepts valid phone without + prefix', () => {
    expect(phoneSchema.safeParse('381641234567').success).toBe(true);
  });

  it('rejects phone with spaces (E.164 strict)', () => {
    expect(phoneSchema.safeParse('+381 64 1234567').success).toBe(false);
  });

  it('rejects phone with dashes (E.164 strict)', () => {
    expect(phoneSchema.safeParse('064-1234567').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false);
  });

  it('rejects phone with letters', () => {
    expect(phoneSchema.safeParse('abc123').success).toBe(false);
  });

  it('rejects phone with less than 6 digits', () => {
    expect(phoneSchema.safeParse('+12345').success).toBe(false);
  });

  it('rejects phone with more than 15 digits', () => {
    expect(phoneSchema.safeParse('+3816412345678901').success).toBe(false);
  });
});

describe('birthDateSchema (FE1 - mora biti u prošlosti)', () => {
  it('accepts valid past date', () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 30);
    const dateStr = pastDate.toISOString().split('T')[0];
    expect(birthDateSchema.safeParse(dateStr).success).toBe(true);
  });

  it('rejects today as birth date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(birthDateSchema.safeParse(today).success).toBe(false);
  });

  it('rejects future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const dateStr = future.toISOString().split('T')[0];
    expect(birthDateSchema.safeParse(dateStr).success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(birthDateSchema.safeParse('').success).toBe(false);
  });

  it('rejects invalid date format', () => {
    expect(birthDateSchema.safeParse('not-a-date').success).toBe(false);
  });

  it('accepts very old date', () => {
    expect(birthDateSchema.safeParse('1900-01-01').success).toBe(true);
  });
});

describe('nameSchema', () => {
  it('accepts a valid name', () => {
    expect(nameSchema.safeParse('Marko').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(nameSchema.safeParse('').success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(nameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });

  it('accepts name at exactly 100 chars', () => {
    expect(nameSchema.safeParse('a'.repeat(100)).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({ email: 'test@banka.rs', password: 'Admin12345' });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    expect(loginSchema.safeParse({ email: '', password: 'test' }).success).toBe(false);
  });

  it('rejects missing password', () => {
    expect(loginSchema.safeParse({ email: 'test@banka.rs', password: '' }).success).toBe(false);
  });

  it('rejects invalid email format', () => {
    expect(loginSchema.safeParse({ email: 'invalid', password: 'test' }).success).toBe(false);
  });
});

describe('createEmployeeSchema (FE1 - ojačane validacije)', () => {
  const validEmployee = {
    firstName: 'Marko',
    lastName: 'Petrovic',
    username: 'marko.p',
    email: 'marko@banka.rs',
    position: 'Developer',
    phoneNumber: '+381641234567',
    isActive: true,
    address: 'Bulevar 1',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    department: 'IT',
  };

  it('accepts valid employee data', () => {
    expect(createEmployeeSchema.safeParse(validEmployee).success).toBe(true);
  });

  it('rejects missing firstName', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, firstName: '' }).success).toBe(false);
  });

  it('rejects missing username', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, username: '' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: 'bad' }).success).toBe(false);
  });

  it('rejects missing department', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, department: '' }).success).toBe(false);
  });

  it('rejects invalid phone (FE1)', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, phoneNumber: 'abc' }).success).toBe(false);
  });

  it('rejects future dateOfBirth (FE1)', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const dateStr = future.toISOString().split('T')[0];
    expect(createEmployeeSchema.safeParse({ ...validEmployee, dateOfBirth: dateStr }).success).toBe(false);
  });
});

describe('editEmployeeSchema (FE1 - ojačane validacije)', () => {
  const validEdit = {
    firstName: 'Marko',
    lastName: 'Petrovic',
    email: 'marko@banka.rs',
    position: 'Developer',
    phoneNumber: '+381641234567',
    isActive: true,
    address: 'Bulevar 1',
    dateOfBirth: '1990-01-01',
    gender: 'M',
    department: 'IT',
  };

  it('accepts valid edit data', () => {
    expect(editEmployeeSchema.safeParse(validEdit).success).toBe(true);
  });

  it('rejects missing lastName', () => {
    expect(editEmployeeSchema.safeParse({ ...validEdit, lastName: '' }).success).toBe(false);
  });

  it('rejects invalid phone (FE1)', () => {
    expect(editEmployeeSchema.safeParse({ ...validEdit, phoneNumber: 'invalid' }).success).toBe(false);
  });

  it('rejects future dateOfBirth (FE1)', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);
    const dateStr = future.toISOString().split('T')[0];
    expect(editEmployeeSchema.safeParse({ ...validEdit, dateOfBirth: dateStr }).success).toBe(false);
  });
});

describe('activateAccountSchema', () => {
  it('accepts matching valid passwords', () => {
    const result = activateAccountSchema.safeParse({
      password: 'Admin12345',
      confirmPassword: 'Admin12345',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-matching passwords', () => {
    const result = activateAccountSchema.safeParse({
      password: 'Admin12345',
      confirmPassword: 'Different12',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak password', () => {
    const result = activateAccountSchema.safeParse({
      password: 'weak',
      confirmPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty confirmPassword', () => {
    const result = activateAccountSchema.safeParse({
      password: 'Admin12345',
      confirmPassword: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'test@banka.rs' }).success).toBe(true);
  });

  it('rejects empty email', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching valid passwords', () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: 'Admin12345',
      confirmPassword: 'Admin12345',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-matching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: 'Admin12345',
      confirmPassword: 'Other12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects weak newPassword', () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: 'abc',
      confirmPassword: 'abc',
    });
    expect(result.success).toBe(false);
  });
});
