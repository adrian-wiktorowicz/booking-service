import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import {
  IAuthService,
  IUserRepository,
  RegisterInput,
  LoginInput,
  LoginResponse,
  UserRecord,
  UserResponse,
  EmailExistsError,
  InvalidCredentialsError,
  IPasswordChecker,
  PasswordCompromisedError,
} from './auth.types.js';
import { signJwt } from './jwt.js';

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
  async findById(id: string): Promise<UserRecord | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  },
  async deleteById(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, id));
    });
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
  private static readonly DUMMY_HASH: string = bcrypt.hashSync('__anti_enumeration_sentinel__', 12);

  constructor(
    private readonly userRepo: IUserRepository = defaultUserRepository,
    private readonly saltRounds: number = 12,
    private readonly pepperSecret: string = process.env.AUTH_PEPPER_SECRET || '',
    private readonly passwordChecker: IPasswordChecker = defaultPasswordChecker,
    readonly jwtSecret: string = process.env.JWT_SECRET || 'default-jwt-secret-for-development-must-be-32-chars'
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

  async login(input: LoginInput): Promise<LoginResponse> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const hasNullByte = normalizedEmail.includes('\0');

    const preparedPassword = pepperPassword(input.password, this.pepperSecret);

    const user = hasNullByte ? null : await this.userRepo.findByEmail(normalizedEmail);
    const targetHash = user ? user.passwordHash : AuthService.DUMMY_HASH;

    const isMatch = await bcrypt.compare(preparedPassword, targetHash);

    const userFound = user !== null && !hasNullByte;
    const authenticated = crypto.timingSafeEqual(
      Buffer.from(userFound && isMatch ? '1' : '0'),
      Buffer.from('1')
    );

    if (!authenticated) {
      throw new InvalidCredentialsError();
    }

    const token = signJwt({ userId: user!.id }, this.jwtSecret, 86400);
    return {
      token,
      expiresIn: 86400,
    };
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    return this.userRepo.findById(userId);
  }

  async deleteAccount(userId: string): Promise<{ status: string }> {
    await this.userRepo.deleteById(userId);
    return { status: 'deleted' };
  }
}

