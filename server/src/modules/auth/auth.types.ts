export interface RegisterInput {
  email: string;
  password: string;
}

export interface UserResponse {
  userId: string;
  email: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: { email: string; passwordHash: string }): Promise<UserRecord>;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export interface IAuthService {
  register(input: RegisterInput): Promise<UserResponse>;
  login(input: LoginInput): Promise<LoginResponse>;
}

export class InvalidCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS';
  readonly statusCode = 401;

  constructor(message = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class EmailExistsError extends Error {
  readonly code = 'EMAIL_EXISTS';
  readonly statusCode = 409;

  constructor(message = 'Email already registered') {
    super(message);
    this.name = 'EmailExistsError';
  }
}

export interface IPasswordChecker {
  isCompromised(password: string): Promise<boolean>;
}

export class PasswordCompromisedError extends Error {
  readonly code = 'PASSWORD_COMPROMISED';
  readonly statusCode = 422;

  constructor(message = 'Password has been compromised in a data breach. Please choose a different password.') {
    super(message);
    this.name = 'PasswordCompromisedError';
  }
}

