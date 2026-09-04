import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterView } from './RegisterView';
import { LoginView } from './LoginView';
import { ApiError } from '../api/client';

describe('AuthViews', () => {
  describe('RegisterView', () => {
    it('displays error message for 409 EMAIL_EXISTS', async () => {
      const mockRegister = vi.fn().mockRejectedValue(
        new ApiError(409, 'EMAIL_EXISTS', 'Email exists in database')
      );

      render(<RegisterView onRegister={mockRegister} onNavigateToLogin={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'existing@example.com' } });
      fireEvent.change(screen.getByLabelText(/^hasło|^password/i), { target: { value: 'validPassword123' } });
      fireEvent.click(screen.getByRole('button', { name: /zarejestruj|register/i }));

      await waitFor(() => {
        expect(screen.getByText(/konto z tym adresem email już istnieje/i)).toBeInTheDocument();
      });
    });

    it('displays error message for 422 PASSWORD_COMPROMISED', async () => {
      const mockRegister = vi.fn().mockRejectedValue(
        new ApiError(422, 'PASSWORD_COMPROMISED', 'Password is compromised')
      );

      render(<RegisterView onRegister={mockRegister} onNavigateToLogin={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText(/^hasło|^password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zarejestruj|register/i }));

      await waitFor(() => {
        expect(screen.getByText(/hasło wyciekło do sieci/i)).toBeInTheDocument();
      });
    });

    it('displays error message for 429 RATE_LIMITED', async () => {
      const mockRegister = vi.fn().mockRejectedValue(
        new ApiError(429, 'RATE_LIMITED', 'Too many requests')
      );

      render(<RegisterView onRegister={mockRegister} onNavigateToLogin={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText(/^hasło|^password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /zarejestruj|register/i }));

      await waitFor(() => {
        expect(screen.getByText(/zbyt wiele prób/i)).toBeInTheDocument();
      });
    });
  });

  describe('LoginView', () => {
    it('displays error message for 401 INVALID_CREDENTIALS and 429 RATE_LIMITED', async () => {
      const mockLogin = vi.fn().mockRejectedValueOnce(
        new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
      );

      const { rerender } = render(<LoginView onLogin={mockLogin} onNavigateToRegister={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@example.com' } });
      fireEvent.change(screen.getByLabelText(/^hasło|^password/i), { target: { value: 'wrongPassword' } });
      fireEvent.click(screen.getByRole('button', { name: /zaloguj|login/i }));

      await waitFor(() => {
        expect(screen.getByText(/niepoprawny email lub hasło/i)).toBeInTheDocument();
      });

      const mockRateLimitLogin = vi.fn().mockRejectedValueOnce(
        new ApiError(429, 'RATE_LIMITED', 'Too many login attempts')
      );

      rerender(<LoginView onLogin={mockRateLimitLogin} onNavigateToRegister={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /zaloguj|login/i }));

      await waitFor(() => {
        expect(screen.getByText(/zbyt wiele prób/i)).toBeInTheDocument();
      });
    });
  });
});
