import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  // If authenticated but not admin, redirect to a restricted page
  if (authService.isAuthenticated()) {
    router.navigate(['/unauthorized']);
    return false;
  }

  // Not authenticated at all
  router.navigate(['/login']);
  return false;
};
