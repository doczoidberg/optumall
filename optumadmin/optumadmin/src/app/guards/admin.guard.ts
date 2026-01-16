import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminUsersService } from '../services/admin-users.service';
import { filter, map, take } from 'rxjs/operators';

export const AdminGuard = () => {
  const adminUsersService = inject(AdminUsersService);
  const router = inject(Router);

  return adminUsersService.role$.pipe(
    filter(role => role !== undefined),
    take(1),
    map(role => {
      if (role === 'admin') {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    })
  );
};

