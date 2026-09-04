import crypto from 'node:crypto';
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
  IPasswordChecker,
  PasswordCompromisedError,
} from './auth.types.js';

export function pepperPassword(password: string, pepperSecret?: string): string {
  if (!pepperSecret) {
    return password;
  }
  return crypto.createHmac('sha256', pepperSecret).update(password).digest('hex');
}

export class HibpPasswordChecker implements IPasswordChecker {
  constructor(private readonly timeoutMs: number = 1500) {}

  async isCompromised(password: string): Promise<boolean> {
    try {
      const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'booking-service-auth' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        return false;
      }

      const body = await res.text();
      const lines = body.split('\n');
      for (const line of lines) {
        const [hashSuffix] = line.trim().split(':');
        if (hashSuffix === suffix) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }
}

const defaultPasswordChecker: IPasswordChecker = new HibpPasswordChecker();

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
    private readonly saltRounds: number = 12,
    private readonly pepperSecret: string = process.env.AUTH_PEPPER_SECRET || '',
    private readonly passwordChecker: IPasswordChecker = defaultPasswordChecker
  ) {}

  async register(input: RegisterInput): Promise<UserResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new EmailExistsError();
    }

    if (await this.passwordChecker.isCompromised(input.password)) {
      throw new PasswordCompromisedError();
    }

    const preparedPassword = pepperPassword(input.password, this.pepperSecret);
    const passwordHash = await bcrypt.hash(preparedPassword, this.saltRounds);
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

