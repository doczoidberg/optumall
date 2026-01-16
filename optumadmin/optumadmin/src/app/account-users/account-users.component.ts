import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LicenseManagementApiService, Account } from '../services/license-management-api.service';

@Component({
  selector: 'app-account-users',
  templateUrl: './account-users.component.html',
  styleUrls: ['./account-users.component.scss']
})
export class AccountUsersComponent implements OnInit {
  account: Account | null = null;
  loading = true;
  error: string | null = null;
  accountId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private licenseApi: LicenseManagementApiService
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.accountId = +params['id'];
      if (this.accountId) {
        this.loadAccount();
      }
    });
  }

  loadAccount(): void {
    this.loading = true;
    this.error = null;

    this.licenseApi.getAccount(this.accountId).subscribe({
      next: (response) => {
        if (response.success) {
          this.account = response.data;
        } else {
          this.error = 'Failed to load account';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading account:', err);
        this.error = 'Error loading account: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  refresh(): void {
    // Clear cache to force fresh data
    this.licenseApi.clearCacheEntry(`account_${this.accountId}`);
    this.loadAccount();
  }
}
