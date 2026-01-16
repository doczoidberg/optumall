import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountsService } from '../../services/accounts.service';
import { Account, getAccountTypeName } from '../../models/account.model';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="accounts-container">
      <header class="page-header">
        <h1>Accounts</h1>
        <p class="subtitle">Manage organizations and their members (replaces Firebase customers)</p>
      </header>

      <div class="toolbar">
        <div class="search-box">
          <input
            type="text"
            placeholder="Search accounts..."
            [(ngModel)]="searchTerm"
            (input)="onSearch()"
          />
        </div>
        <div class="filters">
          <select [(ngModel)]="typeFilter" (change)="applyFilters()">
            <option value="">All Types</option>
            <option value="0">Individual</option>
            <option value="1">Organization</option>
            <option value="3">University</option>
          </select>
        </div>
      </div>

      @if (loading()) {
        <div class="loading">Loading accounts...</div>
      }

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      @if (!loading() && !error()) {
        <div class="stats-bar">
          <div class="stat">
            <span class="stat-value">{{ filteredAccounts().length }}</span>
            <span class="stat-label">Accounts</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ totalMembers() }}</span>
            <span class="stat-label">Total Members</span>
          </div>
        </div>

        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Domain</th>
                <th>Members</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (account of filteredAccounts(); track account.id) {
                <tr>
                  <td>{{ account.id }}</td>
                  <td>
                    <a [routerLink]="['/accounts', account.id]" class="account-link">
                      {{ account.name }}
                    </a>
                  </td>
                  <td>
                    <span class="badge" [class]="getTypeBadgeClass(account.type)">
                      {{ getTypeName(account.type) }}
                    </span>
                  </td>
                  <td>{{ account.domain || '-' }}</td>
                  <td>{{ account.total_members }}</td>
                  <td>{{ formatDate(account.created_date) }}</td>
                  <td>
                    <a [routerLink]="['/accounts', account.id]" class="btn btn-secondary btn-sm">
                      View
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-state">
                    No accounts found
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .accounts-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 24px;

      h1 {
        font-size: 28px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 4px;
      }

      .subtitle {
        color: #666;
        font-size: 14px;
      }
    }

    .toolbar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;

      .search-box {
        flex: 1;
        max-width: 400px;

        input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;

          &:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
          }
        }
      }

      .filters select {
        padding: 10px 14px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        cursor: pointer;
      }
    }

    .stats-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 20px;

      .stat {
        display: flex;
        flex-direction: column;

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #007bff;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
      }
    }

    .account-link {
      font-weight: 500;
      color: #007bff;

      &:hover {
        text-decoration: underline;
      }
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge-individual {
      background-color: #e3f2fd;
      color: #1565c0;
    }

    .badge-organization {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .badge-university {
      background-color: #fff3e0;
      color: #e65100;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  `]
})
export class AccountsComponent implements OnInit {
  private accountsService = inject(AccountsService);

  searchTerm = '';
  typeFilter = '';

  loading = this.accountsService.loading;
  error = this.accountsService.error;

  private allAccounts = signal<Account[]>([]);

  filteredAccounts = computed(() => {
    let accounts = this.allAccounts();

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      accounts = accounts.filter(a =>
        a.name.toLowerCase().includes(term) ||
        a.domain?.toLowerCase().includes(term)
      );
    }

    // Apply type filter
    if (this.typeFilter !== '') {
      const type = parseInt(this.typeFilter, 10);
      accounts = accounts.filter(a => a.type === type);
    }

    return accounts;
  });

  totalMembers = computed(() =>
    this.filteredAccounts().reduce((sum, a) => sum + a.total_members, 0)
  );

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.accountsService.getAccounts().subscribe({
      next: (accounts) => {
        this.allAccounts.set(accounts);
      },
      error: (err) => {
        console.error('Failed to load accounts:', err);
      }
    });
  }

  onSearch(): void {
    // Computed signal handles filtering automatically
  }

  applyFilters(): void {
    // Computed signal handles filtering automatically
  }

  getTypeName(type: number): string {
    return getAccountTypeName(type);
  }

  getTypeBadgeClass(type: number): string {
    switch (type) {
      case 0: return 'badge-individual';
      case 1: return 'badge-organization';
      case 3: return 'badge-university';
      default: return '';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}
