import { Component, OnDestroy } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminUsersService, AdminUser } from '../services/admin-users.service';
import { Auth, authState } from '@angular/fire/auth';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnDestroy {
  readonly roles = ['admin', 'manager', 'viewer'];

  readonly addEmailControl = new FormControl('', [Validators.required, Validators.email]);
  readonly addRoleControl = new FormControl('viewer', [Validators.required]);

  readonly dataSource = new MatTableDataSource<AdminUser>([]);
  readonly displayedColumns = ['email', 'role', 'actions'];

  currentUserEmail = '';
  loading = true;
  saving = false;
  lastInviteLink: string | null = null;
  lastInviteEmail: string | null = null;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly auth: Auth,
    private readonly snackBar: MatSnackBar
  ) {
    this.subscriptions.add(
      authState(this.auth).subscribe(user => {
        this.currentUserEmail = user?.email?.toLowerCase() ?? '';
      })
    );

    this.subscriptions.add(
      this.adminUsersService.adminUsers$.subscribe({
        next: users => {
          this.dataSource.data = users;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.snackBar.open('Failed to load admin users', 'Close', { duration: 4000 });
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async addOrUpdateUser(): Promise<void> {
    this.addEmailControl.markAsTouched();
    this.addRoleControl.markAsTouched();

    if (this.addEmailControl.invalid || this.addRoleControl.invalid) {
      return;
    }

    const email = (this.addEmailControl.value || '').trim().toLowerCase();
    const role = this.addRoleControl.value || 'viewer';

    const existing = this.dataSource.data.some(user => user.email === email);
    this.saving = true;
    try {
      const result = await this.adminUsersService.upsertUser(email, role);
      this.snackBar.open(existing ? 'User role updated' : 'User added', 'Close', { duration: 3000 });
      this.lastInviteLink = !existing ? result.resetLink ?? null : null;
      this.lastInviteEmail = !existing ? email : null;
      this.addEmailControl.reset('');
      this.addRoleControl.setValue('viewer');
    } catch (error) {
      console.error('Failed to update user role', error);
      this.snackBar.open('Failed to update user role', 'Close', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }

  async changeRole(user: AdminUser, role: string): Promise<void> {
    if (user.role === role) {
      return;
    }

    if (user.email === this.currentUserEmail && role !== 'admin') {
      this.snackBar.open('You cannot change your own role.', 'Close', { duration: 4000 });
      return;
    }

    try {
      await this.adminUsersService.updateUserRole(user.email, role);
      this.snackBar.open('Role updated', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to update role', error);
      this.snackBar.open('Failed to update role', 'Close', { duration: 5000 });
    }
  }

  async removeUser(user: AdminUser): Promise<void> {
    if (user.email === 'info@seoaachen.de') {
      this.snackBar.open('The primary administrator cannot be removed.', 'Close', { duration: 4000 });
      return;
    }

    if (user.email === this.currentUserEmail) {
      this.snackBar.open('You cannot remove your own access.', 'Close', { duration: 4000 });
      return;
    }

    try {
      await this.adminUsersService.deleteUser(user.email);
      this.snackBar.open('User removed', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to remove user', error);
      this.snackBar.open('Failed to remove user', 'Close', { duration: 5000 });
    }
  }

  async copyInviteLink(): Promise<void> {
    if (!this.lastInviteLink || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.lastInviteLink);
      this.snackBar.open('Invite link copied to clipboard', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to copy invite link', error);
      this.snackBar.open('Unable to copy link. Copy it manually.', 'Close', { duration: 4000 });
    }
  }
}
