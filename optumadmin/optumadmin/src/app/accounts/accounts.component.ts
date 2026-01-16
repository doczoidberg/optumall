import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LicenseManagementApiService, Account, Stats } from '../services/license-management-api.service';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.component.html',
  styleUrls: ['./accounts.component.scss']
})
export class AccountsComponent implements OnInit {
  accounts: Account[] = [];
  stats: Stats | null = null;
  loading = true;
  error: string | null = null;
  searchQuery = '';
  filteredAccounts: Account[] = [];
  paginatedAccounts: Account[] = [];

  // Filtering
  selectedType: string = 'all';
  accountTypes = [
    { value: 'all', label: 'All Types' },
    { value: '0', label: 'Individual' },
    { value: '1', label: 'Organization' },
    { value: '3', label: 'University' }
  ];

  // Sorting
  sortColumn: string = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  pageSizeOptions = [10, 20, 50, 100];

  displayedColumns: string[] = ['id', 'name', 'domain', 'type', 'members', 'created', 'actions'];

  // Expose Math for template
  Math = Math;

  constructor(
    private licenseApi: LicenseManagementApiService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadAccounts();
    this.loadStats();
  }

  loadAccounts(): void {
    this.loading = true;
    this.error = null;

    this.licenseApi.getAllAccounts().subscribe({
      next: (response) => {
        if (response.success) {
          this.accounts = response.data;
          this.filteredAccounts = [...this.accounts];
          this.applySort();
          this.updatePagination();
        } else {
          this.error = 'Failed to load accounts';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading accounts:', err);
        this.error = 'Error loading accounts: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    this.licenseApi.getStats().subscribe({
      next: (response) => {
        if (response.success) {
          this.stats = response.data;
        }
      },
      error: (err) => {
        console.error('Error loading stats:', err);
      }
    });
  }

  viewAccount(account: Account): void {
    this.router.navigate(['/accounts', account.id]);
  }

  filterAccounts(): void {
    let filtered = [...this.accounts];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(account =>
        account.name.toLowerCase().includes(query) ||
        account.domain?.toLowerCase().includes(query) ||
        account.type_name.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(account => account.type === parseInt(this.selectedType));
    }

    this.filteredAccounts = filtered;
    this.applySort();
    this.updatePagination();
  }

  applySort(): void {
    this.filteredAccounts.sort((a, b) => {
      let aValue: any = a[this.sortColumn as keyof Account];
      let bValue: any = b[this.sortColumn as keyof Account];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      // Toggle direction if same column
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applySort();
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredAccounts.length / this.pageSize);
    if (this.currentPage > this.totalPages) {
      this.currentPage = Math.max(1, this.totalPages);
    }
    this.paginateAccounts();
  }

  paginateAccounts(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedAccounts = this.filteredAccounts.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.paginateAccounts();
    }
  }

  changePageSize(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  refresh(): void {
    // Clear cache to force fresh data
    this.licenseApi.clearCacheEntry('accounts_all');
    this.licenseApi.clearCacheEntry('stats');
    this.loadAccounts();
    this.loadStats();
  }
}
