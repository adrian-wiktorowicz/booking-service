import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import {
  IAuthService,
  IUserRepository,
  RegisterInput,
  UserRecord,
  UserResponse,
  EmailExistsError,
} from './auth.types.js';

const defaultUserRepository: IUserRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  },
  async create(data: { email: string; passwordHash: string }): Promise<UserRecord> {
    try {
      const [user] = await db
        .insert(users)
        .values({
          email: data.email,
          passwordHash: data.passwordHash,
        })
        .returning();
      return user;
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate key')) {
        throw new EmailExistsError();
      }
      throw err;
    }
  },
};

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepo: IUserRepository = defaultUserRepository,
    private readonly saltRounds: number = 12
  ) {}

  async register(input: RegisterInput): Promise<UserResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new EmailExistsError();
    }

    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);
    try {
      const user = await this.userRepo.create({
        email: normalizedEmail,
        passwordHash,
      });

      return {
        userId: user.id,
        email: user.email,
      };
    } catch (err: any) {
      if (err?.code === '23505' || err?.message?.includes('duplicate key')) {
        throw new EmailExistsError();
      }
      throw err;
    }
  }
}
