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

export interface IAuthService {
  register(input: RegisterInput): Promise<UserResponse>;
}

export class EmailExistsError extends Error {
  readonly code = 'EMAIL_EXISTS';
  readonly statusCode = 409;

  constructor(message = 'Email already registered') {
    super(message);
    this.name = 'EmailExistsError';
  }
}
