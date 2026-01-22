<template>
  <div id="page-wrapper">
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-12">
          <h1 class="page-header">Optum Tokens</h1>
        </div>
      </div>

      <!-- Token Balance Card -->
      <div class="row">
        <div class="col-lg-12">
          <div class="panel panel-default">
            <div class="panel-heading">
              <i class="fa fa-coins fa-fw"></i> Token Balance
            </div>
            <div class="panel-body">
              <div class="row" v-if="balance">
                <div class="col-md-3">
                  <div style="font-size: 22px; font-weight: bold; color: #3498db;">
                    Total Tokens: {{ formatNumber(balance.credits) }}
                  </div>
                  <div style="font-size: 18px; color: #7f8c8d; margin-top: 10px;">
                    Used: {{ formatNumber(balance.credits_used) }}
                  </div>
                </div>
                <div class="col-md-3">
                  <div style="font-size: 22px; font-weight: bold; color: #2ecc71;">
                    Available: {{ formatNumber(balance.available_credits) }}
                  </div>
                  <div style="font-size: 14px; color: #7f8c8d; margin-top: 10px;">
                    <span v-if="balance.last_purchase_date">
                      Last purchase: {{ formatDate(balance.last_purchase_date) }}
                    </span>
                    <span v-else>No purchases yet</span>
                  </div>
                </div>
                <div class="col-md-6">
                  <div style="padding: 15px; background-color: #ecf0f1; border-radius: 5px;">
                    <i class="fa fa-info-circle"></i>
                    <strong>Note:</strong> Each cloud job consumes tokens based on computation time and resources used.
                  </div>
                </div>
              </div>
              <div v-else class="text-center">
                <i class="fa fa-spinner fa-spin fa-2x"></i>
                <p>Loading balance...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Token Purchase -->
      <div class="row" v-if="!isSuperAdmin">
        <div class="col-lg-12">
          <div class="panel panel-primary">
            <div class="panel-heading">
              <i class="fa fa-shopping-cart fa-fw"></i> Purchase Optum Tokens - Custom Amount
            </div>
            <div class="panel-body">
              <div v-if="checkoutError" class="alert alert-danger">
                {{ checkoutError }}
              </div>

              <!-- Custom Token Purchase -->
              <div class="custom-purchase-section">
                <div class="row">
                  <div class="col-md-12">
                    <h4 style="margin-top: 0; color: #2c3e50;">
                      <i class="fa fa-bolt"></i> Buy Custom Amount
                    </h4>
                    <p style="color: #7f8c8d; margin-bottom: 20px;">
                      Choose exactly how many tokens you need at <strong>€0.20 per token</strong>
                    </p>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-5">
                    <div class="form-group">
                      <label for="customTokenAmount">Number of Tokens</label>
                      <input
                        type="number"
                        class="form-control input-lg"
                        id="customTokenAmount"
                        v-model.number="customTokens"
                        @input="calculateCustomPrice"
                        min="100"
                        max="100000"
                        step="100"
                        placeholder="Enter token amount (min: 100)"
                      />
                      <small class="text-muted">Minimum: 100 tokens | Maximum: 100,000 tokens</small>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="custom-price-display">
                      <div class="price-label">Total Price</div>
                      <div class="price-value">{{ formatPrice(customPrice) }}</div>
                      <div class="price-detail">€0.20 per token</div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div style="padding-top: 25px;">
                      <button
                        class="btn btn-success btn-block btn-lg"
                        @click="startCustomCheckout"
                        :disabled="!isValidCustomAmount || customCheckoutLoading"
                        style="height: 60px; font-size: 18px;"
                      >
                        <i v-if="customCheckoutLoading" class="fa fa-spinner fa-spin"></i>
                        <i v-else class="fa fa-shopping-cart"></i>
                        <span v-if="customCheckoutLoading"> Processing...</span>
                        <span v-else> Buy {{ formatNumber(customTokens) }} Tokens</span>
                      </button>
                      <div v-if="customCheckoutLoading" class="text-center" style="margin-top: 8px;">
                        <small class="text-muted">Please do not close this window.</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legacy Token Packages (Deprecated) -->
      <div class="row" v-if="!isSuperAdmin">
        <div class="col-lg-12">
          <div class="panel panel-default">
            <div class="panel-heading" style="background-color: #ecf0f1; color: #7f8c8d;">
              <i class="fa fa-archive fa-fw"></i> Legacy Token Packages
              <span class="label label-warning" style="margin-left: 10px;">DEPRECATED</span>
            </div>
            <div class="panel-body" style="background-color: #f9f9f9;">
              <div class="alert alert-warning">
                <i class="fa fa-exclamation-triangle"></i>
                <strong>Note:</strong> These packages are deprecated. Please use the custom token purchase above for better flexibility and pricing.
              </div>

              <div class="row">
                <div class="col-md-4" v-for="pkg in packages" :key="pkg.id">
                  <div class="package-card deprecated">
                    <div class="deprecated-badge">LEGACY</div>
                    <div class="package-header">
                      <h3 class="package-name">{{ pkg.name }}</h3>
                    </div>
                    <div class="package-body">
                      <div class="package-tokens">
                        <span class="token-amount">{{ formatNumber(pkg.tokens) }}</span>
                        <span class="token-label">tokens</span>
                      </div>
                      <div class="package-description">{{ pkg.description }}</div>
                      <div class="package-price">{{ formatPrice(pkg.price) }}</div>
                      <div class="package-price-per-token">
                        €{{ (pkg.price / pkg.tokens).toFixed(2) }} per token
                      </div>
                    </div>
                    <div class="package-footer">
                      <button
                        class="btn btn-default btn-block btn-lg"
                        @click="startCheckout(pkg.id)"
                        :disabled="checkoutLoading[pkg.id]"
                      >
                        <i v-if="checkoutLoading[pkg.id]" class="fa fa-spinner fa-spin"></i>
                        <span v-if="checkoutLoading[pkg.id]">Processing...</span>
                        <span v-else>Buy Now</span>
                      </button>
                      <div v-if="checkoutLoading[pkg.id]" class="package-hint">
                        Please do not close this window.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Admin Section: Manually Assign Tokens (SuperAdmin Only) -->
      <div class="row" v-if="isSuperAdmin">
        <div class="col-lg-12">
          <div class="panel panel-primary">
            <div class="panel-heading">
              <i class="fa fa-user-shield fa-fw"></i> Admin: Manually Assign Tokens
            </div>
            <div class="panel-body">
              <div v-if="assignSuccess" class="alert alert-success alert-dismissible">
                <button type="button" class="close" @click="assignSuccess = null">&times;</button>
                {{ assignSuccess }}
              </div>
              <div v-if="assignError" class="alert alert-danger alert-dismissible">
                <button type="button" class="close" @click="assignError = null">&times;</button>
                {{ assignError }}
              </div>

              <form @submit.prevent="assignTokensManually">
                <div class="row">
                  <div class="col-md-4">
                    <div class="form-group">
                      <label for="accountId">Account ID <span class="text-danger">*</span></label>
                      <div class="input-group">
                        <input
                          type="number"
                          class="form-control"
                          id="accountId"
                          v-model.number="assignForm.account_id"
                          required
                          placeholder="Enter account ID"
                        />
                        <span class="input-group-btn">
                          <button
                            type="button"
                            class="btn btn-default"
                            @click="showAccountSearch = !showAccountSearch"
                            title="Search for account"
                          >
                            <i class="fa fa-search"></i>
                          </button>
                        </span>
                      </div>
                      <small class="form-text text-muted">The account to receive tokens</small>
                    </div>
                    <!-- Account Search Dropdown -->
                    <div v-if="showAccountSearch" class="account-search-box">
                      <div class="form-group">
                        <input
                          type="text"
                          class="form-control input-sm"
                          v-model="accountSearchQuery"
                          placeholder="Search by account name or ID..."
                          @input="searchAccounts"
                        />
                      </div>
                      <div class="account-search-results">
                        <div v-if="searchingAccounts" class="text-center" style="padding: 10px;">
                          <i class="fa fa-spinner fa-spin"></i> Searching...
                        </div>
                        <div v-else-if="accountSearchResults.length === 0" class="text-muted" style="padding: 10px;">
                          No accounts found. Try a different search term.
                        </div>
                        <div
                          v-else
                          v-for="account in accountSearchResults"
                          :key="account.id"
                          class="account-search-item"
                          @click="selectAccount(account)"
                        >
                          <strong>ID: {{ account.id }}</strong> - {{ account.name }}
                          <br>
                          <small class="text-muted">
                            Type: {{ account.type }} | Members: {{ account.totalMember || 0 }}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="form-group">
                      <label for="tokenAmount">Token Amount <span class="text-danger">*</span></label>
                      <input
                        type="number"
                        class="form-control"
                        id="tokenAmount"
                        v-model.number="assignForm.credits"
                        required
                        min="0"
                        step="0.01"
                        placeholder="e.g. 1000"
                      />
                      <small class="form-text text-muted">Number of tokens to assign</small>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <div class="form-group">
                      <label for="reason">Reason <span class="text-danger">*</span></label>
                      <input
                        type="text"
                        class="form-control"
                        id="reason"
                        v-model="assignForm.reason"
                        required
                        placeholder="e.g. Promotional credit"
                      />
                      <small class="form-text text-muted">Why tokens are being assigned</small>
                    </div>
                  </div>
                </div>
                <div class="row">
                  <div class="col-md-12">
                    <button
                      type="submit"
                      class="btn btn-primary btn-lg"
                      :disabled="assignLoading"
                    >
                      <i v-if="assignLoading" class="fa fa-spinner fa-spin"></i>
                      <i v-else class="fa fa-plus-circle"></i>
                      <span v-if="assignLoading">Assigning Tokens...</span>
                      <span v-else>Assign Tokens</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- SuperAdmin: All Token Purchases Across All Accounts -->
      <div class="row" v-if="isSuperAdmin">
        <div class="col-lg-12">
          <div class="panel panel-info">
            <div class="panel-heading">
              <i class="fa fa-globe fa-fw"></i> All Token Purchases (All Accounts)
              <div class="pull-right">
                <select v-model="filterStatus" @change="getAllTransactions" class="form-control input-sm" style="display: inline-block; width: auto;">
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            <div class="panel-body">
              <div class="table-responsive" v-if="allTransactions && allTransactions.length > 0">
                <table class="table table-striped table-bordered table-hover">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account ID</th>
                      <th>Account Name</th>
                      <th>Package</th>
                      <th>Tokens</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Payment Intent</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="transaction in allTransactions" :key="transaction.id">
                      <td>{{ formatDate(transaction.created_date) }}</td>
                      <td>{{ transaction.account_id }}</td>
                      <td>{{ transaction.account_name }}</td>
                      <td>{{ transaction.package_name }}</td>
                      <td>{{ formatNumber(transaction.credits) }}</td>
                      <td>{{ formatPrice(transaction.amount) }}</td>
                      <td>
                        <span
                          class="label"
                          :class="{
                            'label-success': transaction.status === 'completed',
                            'label-warning': transaction.status === 'pending',
                            'label-danger': transaction.status === 'failed'
                          }"
                        >
                          {{ transaction.status }}
                        </span>
                      </td>
                      <td style="font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">
                        {{ transaction.stripe_payment_intent || 'N/A' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else-if="allTransactions && allTransactions.length === 0" class="text-center">
                <p style="padding: 20px; color: #7f8c8d;">No transactions found</p>
              </div>
              <div v-else class="text-center">
                <i class="fa fa-spinner fa-spin fa-2x"></i>
                <p>Loading all transactions...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction History Card -->
      <div class="row">
        <div class="col-lg-12">
          <div class="panel panel-default">
            <div class="panel-heading">
              <i class="fa fa-history fa-fw"></i> My Transaction History
            </div>
            <div class="panel-body">
              <div class="table-responsive" v-if="transactions && transactions.length > 0">
                <table class="table table-striped table-bordered table-hover">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Package</th>
                      <th>Tokens</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="transaction in transactions" :key="transaction.id">
                      <td>{{ formatDate(transaction.created_date) }}</td>
                      <td>{{ transaction.package_name }}</td>
                      <td>{{ formatNumber(transaction.credits) }}</td>
                      <td>{{ formatPrice(transaction.amount) }}</td>
                      <td>
                        <span
                          class="label"
                          :class="{
                            'label-success': transaction.status === 'completed',
                            'label-warning': transaction.status === 'pending',
                            'label-danger': transaction.status === 'failed'
                          }"
                        >
                          {{ transaction.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else-if="transactions && transactions.length === 0" class="text-center">
                <p style="padding: 20px; color: #7f8c8d;">No transactions yet</p>
              </div>
              <div v-else class="text-center">
                <i class="fa fa-spinner fa-spin fa-2x"></i>
                <p>Loading transactions...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Tokens',
  data() {
    return {
      packages: [],
      balance: null,
      transactions: null,
      allTransactions: null, // SuperAdmin: all transactions across all accounts
      filterStatus: '', // SuperAdmin: filter transactions by status
      checkoutLoading: {},
      checkoutError: null,
      apiUrl: process.env.VUE_APP_API_URL || 'http://localhost:8000',
      // Custom token purchase
      customTokens: 1000,
      customPrice: 200,
      customCheckoutLoading: false,
      pricing: null,
      // Admin token assignment
      assignForm: {
        account_id: null,
        credits: null,
        reason: ''
      },
      assignLoading: false,
      assignSuccess: null,
      assignError: null,
      // Account search
      showAccountSearch: false,
      accountSearchQuery: '',
      accountSearchResults: [],
      searchingAccounts: false,
      searchTimeout: null
    };
  },
  computed: {
    isSuperAdmin() {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user && user.role === 2;
    },
    isValidCustomAmount() {
      return this.customTokens >= 100 && this.customTokens <= 100000;
    }
  },
  created() {
    this.loadData();
  },
  methods: {
    async loadData() {
      const promises = [
        this.getPackages(),
        this.getBalance(),
        this.getTransactions()
      ];

      // SuperAdmin: also load all transactions
      if (this.isSuperAdmin) {
        promises.push(this.getAllTransactions());
      }

      await Promise.all(promises);

      // Check for success/cancel in URL
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
      const sessionId = urlParams.get('session_id');
      if (sessionId && window.location.hash.includes('/tokens/success')) {
        this.$swal({
          icon: 'success',
          title: 'Payment Successful!',
          text: 'Your tokens have been added to your account.',
          confirmButtonText: 'OK'
        }).then(() => {
          // Reload balance
          this.getBalance();
          this.getTransactions();
          // Reload all transactions for superadmin
          if (this.isSuperAdmin) {
            this.getAllTransactions();
          }
          // Clean URL - redirect to appropriate route based on user role
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          if (user.role >= 1) {
            this.$router.replace('/admin/tokens');
          } else {
            this.$router.replace('/tokens');
          }
        });
      }
    },
    async getPackages() {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await axios.get(`${this.apiUrl}/api/credits/packages`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });

        if (response.data.success) {
          this.packages = Object.values(response.data.data);
        }
      } catch (error) {
        console.error('Error loading packages:', error);
        this.packages = []; // Set empty array to stop loading spinner
        if (error.response && error.response.status === 401) {
          this.$router.push('/login');
        }
      }
    },
    async getBalance() {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await axios.get(`${this.apiUrl}/api/credits/balance`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });

        if (response.data.success) {
          this.balance = response.data.data;
        }
      } catch (error) {
        console.error('Error loading balance:', error);
        this.balance = {
          credits: 0,
          credits_used: 0,
          available_credits: 0,
          last_purchase_date: null
        };
        if (error.response && error.response.status === 401) {
          this.$router.push('/login');
        }
      }
    },
    async getTransactions() {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await axios.get(`${this.apiUrl}/api/credits/transactions`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });

        if (response.data.success) {
          this.transactions = response.data.data;
        }
      } catch (error) {
        console.error('Error loading transactions:', error);
        this.transactions = []; // Set empty array to stop loading spinner
        if (error.response && error.response.status === 401) {
          this.$router.push('/login');
        }
      }
    },
    async getAllTransactions() {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        const params = {};

        if (this.filterStatus) {
          params.status = this.filterStatus;
        }

        const response = await axios.get(`${this.apiUrl}/api/credits/all-transactions`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          },
          params: params
        });

        if (response.data.success) {
          this.allTransactions = response.data.data;
        }
      } catch (error) {
        console.error('Error loading all transactions:', error);
        this.allTransactions = []; // Always set to empty array
        // If access denied, show appropriate message
        if (error.response && error.response.status === 403) {
          console.warn('Access denied: SuperAdmin role required');
        } else if (error.response && error.response.status === 401) {
          this.$router.push('/login');
        }
      }
    },
    async startCheckout(packageId) {
      const user = JSON.parse(localStorage.getItem('user'));

      if (!user || !user.account_id) {
        this.checkoutError = 'User information is missing. Please log in again.';
        return;
      }

      this.checkoutError = null;
      this.$set(this.checkoutLoading, packageId, true);

      try {
        const response = await axios.post(
          `${this.apiUrl}/api/credits/checkout`,
          {
            package: packageId,
            account_id: user.account_id
          },
          {
            headers: {
              'Authorization': `Bearer ${user.token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success && response.data.data.url) {
          // Redirect to Stripe checkout
          window.location.href = response.data.data.url;
        } else {
          this.checkoutError = 'Failed to create checkout session. Please try again.';
          this.$set(this.checkoutLoading, packageId, false);
        }
      } catch (error) {
        console.error('Error creating checkout session:', error);
        this.checkoutError = (error.response && error.response.data && error.response.data.message) || 'Failed to start checkout. Please try again.';
        this.$set(this.checkoutLoading, packageId, false);
      }
    },
    formatNumber(value) {
      if (!value && value !== 0) return '0';
      return new Intl.NumberFormat('en-US').format(value);
    },
    formatPrice(price) {
      if (!price && price !== 0) return '€0.00';
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(price);
    },
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    async assignTokensManually() {
      // Clear previous messages
      this.assignSuccess = null;
      this.assignError = null;

      // Validate form
      if (!this.assignForm.account_id || !this.assignForm.credits || !this.assignForm.reason) {
        this.assignError = 'Please fill in all required fields.';
        return;
      }

      if (this.assignForm.credits <= 0) {
        this.assignError = 'Token amount must be greater than 0.';
        return;
      }

      this.assignLoading = true;

      try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await axios.post(
          `${this.apiUrl}/api/credits/add-manual`,
          this.assignForm,
          {
            headers: {
              'Authorization': `Bearer ${user.token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success) {
          this.assignSuccess = `Successfully assigned ${this.formatNumber(this.assignForm.credits)} tokens to account ${this.assignForm.account_id}.`;

          // Reset form
          this.assignForm = {
            account_id: null,
            credits: null,
            reason: ''
          };

          // Refresh transactions to show the manual addition
          await this.getTransactions();

          // Also refresh all transactions for superadmin
          if (this.isSuperAdmin) {
            await this.getAllTransactions();
          }
        } else {
          this.assignError = response.data.message || 'Failed to assign tokens.';
        }
      } catch (error) {
        console.error('Error assigning tokens:', error);
        this.assignError = (error.response && error.response.data && error.response.data.message)
          || 'Failed to assign tokens. Please try again.';
      } finally {
        this.assignLoading = false;
      }
    },
    async searchAccounts() {
      // Debounce the search
      clearTimeout(this.searchTimeout);

      if (this.accountSearchQuery.trim().length < 2) {
        this.accountSearchResults = [];
        return;
      }

      this.searchTimeout = setTimeout(async () => {
        this.searchingAccounts = true;
        try {
          const user = JSON.parse(localStorage.getItem('user'));
          const response = await axios.get(
            `${this.apiUrl}/api/admin/accounts/search`,
            {
              params: { q: this.accountSearchQuery },
              headers: {
                'Authorization': `Bearer ${user.token}`
              }
            }
          );

          if (response.data.success) {
            this.accountSearchResults = response.data.data;
          }
        } catch (error) {
          console.error('Error searching accounts:', error);
          // If the endpoint doesn't exist, we'll show an empty list
          this.accountSearchResults = [];
        } finally {
          this.searchingAccounts = false;
        }
      }, 300);
    },
    selectAccount(account) {
      this.assignForm.account_id = account.id;
      this.showAccountSearch = false;
      this.accountSearchQuery = '';
      this.accountSearchResults = [];
    },
    calculateCustomPrice() {
      const pricePerToken = 0.20;
      this.customPrice = this.customTokens * pricePerToken;
    },
    async startCustomCheckout() {
      const user = JSON.parse(localStorage.getItem('user'));

      if (!user || !user.account_id) {
        this.checkoutError = 'User information is missing. Please log in again.';
        return;
      }

      if (!this.isValidCustomAmount) {
        this.checkoutError = 'Please enter a valid token amount between 100 and 100,000.';
        return;
      }

      this.checkoutError = null;
      this.customCheckoutLoading = true;

      try {
        const response = await axios.post(
          `${this.apiUrl}/api/credits/checkout-custom`,
          {
            tokens: this.customTokens,
            account_id: user.account_id
          },
          {
            headers: {
              'Authorization': `Bearer ${user.token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.success && response.data.data.url) {
          // Redirect to Stripe checkout
          window.location.href = response.data.data.url;
        } else {
          this.checkoutError = 'Failed to create checkout session. Please try again.';
          this.customCheckoutLoading = false;
        }
      } catch (error) {
        console.error('Error creating custom checkout session:', error);
        this.checkoutError = (error.response && error.response.data && error.response.data.message) || 'Failed to start checkout. Please try again.';
        this.customCheckoutLoading = false;
      }
    }
  }
};
</script>

<style scoped>
.package-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 20px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.package-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.package-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  text-align: center;
}

.package-name {
  margin: 0;
  font-size: 24px;
  font-weight: bold;
}

.package-body {
  padding: 30px 20px;
  text-align: center;
}

.package-tokens {
  margin-bottom: 15px;
}

.token-amount {
  font-size: 48px;
  font-weight: bold;
  color: #2c3e50;
  display: block;
  line-height: 1;
}

.token-label {
  font-size: 16px;
  color: #7f8c8d;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.package-description {
  color: #7f8c8d;
  margin-bottom: 20px;
  min-height: 40px;
}

.package-price {
  font-size: 32px;
  font-weight: bold;
  color: #27ae60;
  margin-bottom: 10px;
}

.package-footer {
  padding: 0 20px 20px;
}

.package-hint {
  text-align: center;
  color: #7f8c8d;
  font-size: 12px;
  margin-top: 8px;
}

.payment-error {
  margin-bottom: 20px;
}

.gap10 {
  height: 10px;
}

/* Account search dropdown */
.account-search-box {
  position: relative;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
  z-index: 1000;
}

.account-search-results {
  max-height: 300px;
  overflow-y: auto;
  margin-top: 5px;
}

.account-search-item {
  padding: 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.account-search-item:hover {
  background-color: #e8f4f8;
}

.account-search-item:last-child {
  border-bottom: none;
}

/* Custom Token Purchase Section */
.custom-purchase-section {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 2px solid #3498db;
}

.custom-price-display {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.price-label {
  font-size: 14px;
  margin-bottom: 5px;
  opacity: 0.9;
}

.price-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 5px;
}

.price-detail {
  font-size: 12px;
  opacity: 0.8;
}

/* Deprecated Package Styles */
.package-card.deprecated {
  opacity: 0.8;
  position: relative;
  filter: grayscale(30%);
}

.package-card.deprecated:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.package-card.deprecated .package-header {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
}

.package-card.deprecated .package-price {
  color: #7f8c8d;
}

.deprecated-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: #f39c12;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.package-price-per-token {
  font-size: 14px;
  color: #e74c3c;
  margin-top: 5px;
  font-weight: bold;
}
</style>
