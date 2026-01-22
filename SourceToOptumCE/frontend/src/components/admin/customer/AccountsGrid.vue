<template>
  <div id="page-wrapper" class="accounts-page accounts-grid">
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-12">
          <h1 class="page-header">Accounts Management</h1>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-10 sort-left">
          <span>View: </span>&nbsp;&nbsp;
          <router-link to="/admin/accounts/grid" class="btn active">Accounts</router-link>
          <router-link to="/admin/users/grid" class="btn">Users</router-link>
          <router-link to="/admin/group/grid" class="btn">Groups</router-link>
          <div class="content-search">
            <input class="form-control search-input" v-model="keyword" @keyup="applyFilter" type="text" placeholder="Search accounts...">
            <button class="btn btn-search" @click="applyFilter"><i class="fa fa-search"></i></button>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-5 change-view">
          <span v-if="accounts.items">({{filteredRows.length}} accounts)</span>
        </div>
      </div>

      <div class="row">
        <div class="col-lg-12">
          <div class="panel panel-default">
            <div class="panel-body">
              <div v-if="!accounts.items" class="text-center" style="padding: 50px;">
                <i class="fa fa-spinner fa-spin fa-3x"></i>
                <p>Loading accounts...</p>
              </div>

              <div v-else class="row">
                <div v-for="item in filteredRows" :key="item.id" class="col-lg-4 card-mb">
                  <div class="row item-profile account-item">
                    <div class="col-xs-12 card-right">
                      <router-link :to="`/admin/account/detail/${item.id}`" style="text-decoration: none; color: inherit;">
                        <div class="account-card">
                          <div class="account-header">
                            <i class="fa fa-building fa-2x"></i>
                          </div>
                          <h4>{{ item.name }}</h4>
                          <div class="account-meta">
                            <p><strong>Type:</strong> {{ getAccountType(item.type) }}</p>
                            <p><strong>Members:</strong> {{ item.totalMember || 0 }}</p>
                            <p><strong>Groups:</strong> {{ item.totalGroup || 0 }}</p>
                            <p v-if="item.email"><strong>Email:</strong> {{ item.email }}</p>
                          </div>
                          <div class="account-stats">
                            <div class="stat-item">
                              <i class="fa fa-key"></i>
                              <span>{{ item.totalLicense || 0 }} Licenses</span>
                            </div>
                            <div class="stat-item" v-if="item.credits !== undefined">
                              <i class="fa fa-coins"></i>
                              <span>{{ formatNumber(item.credits || 0) }} Tokens</span>
                            </div>
                          </div>
                        </div>
                      </router-link>
                    </div>
                  </div>
                </div>

                <div v-if="filteredRows.length === 0" class="col-lg-12 text-center" style="padding: 50px;">
                  <p style="color: #999;">No accounts found matching your search.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
  name: 'AccountsGrid',
  data() {
    return {
      keyword: '',
      accountFilterKey: 'all',
      currentSort: 'name',
      currentSortDir: 'asc'
    };
  },
  created() {
    this.getAllAccounts();
  },
  methods: {
    ...mapActions('accounts', {
      getAllAccounts: 'getAll'
    }),
    applyFilter() {
      if (this.keyword != '') {
        this.accountFilterKey = 'apply';
      } else {
        this.accountFilterKey = 'all';
      }
    },
    getAccountType(type) {
      const types = {
        0: 'Individual',
        1: 'Company',
        2: 'Organization'
      };
      return types[type] || 'Unknown';
    },
    formatNumber(value) {
      if (!value && value !== 0) return '0';
      return new Intl.NumberFormat('en-US').format(value);
    },
    filterByName: function(row) {
      if (this.keyword != '') {
        const searchTerm = this.keyword.toLowerCase();
        const name = (row.name || '').toLowerCase();
        const email = (row.email || '').toLowerCase();
        return name.includes(searchTerm) || email.includes(searchTerm);
      }
      return true;
    },
    orderBy: function(a, b) {
      let modifier = 1;
      if (this.currentSortDir === 'desc') modifier = -1;
      if (a[this.currentSort] < b[this.currentSort]) return -1 * modifier;
      if (a[this.currentSort] > b[this.currentSort]) return 1 * modifier;
      return 0;
    }
  },
  computed: {
    ...mapState({
      accounts: state => state.accounts.all
    }),
    filteredRows() {
      return this[this.accountFilterKey];
    },
    all() {
      return this.accounts.items || [];
    },
    apply() {
      return (this.accounts.items || [])
        .filter(this.filterByName)
        .sort(this.orderBy);
    }
  }
};
</script>

<style scoped>
.account-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  transition: transform 0.2s, box-shadow 0.2s;
  background-color: white;
  min-height: 280px;
}

.account-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.account-header {
  text-align: center;
  margin-bottom: 15px;
  color: #337ab7;
}

.account-card h4 {
  margin: 10px 0;
  color: #2c3e50;
  font-weight: bold;
  text-align: center;
  min-height: 48px;
}

.account-meta {
  margin: 15px 0;
  font-size: 14px;
  color: #666;
}

.account-meta p {
  margin: 5px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.stat-item {
  text-align: center;
}

.stat-item i {
  display: block;
  margin-bottom: 5px;
  color: #337ab7;
}

.stat-item span {
  font-size: 12px;
  color: #666;
}

.card-mb {
  margin-bottom: 20px;
}

.content-search {
  display: inline-block;
  margin-left: 20px;
}

.search-input {
  display: inline-block;
  width: 300px;
  margin-right: 10px;
}

.btn-search {
  padding: 6px 12px;
}

.sort-left {
  margin-bottom: 20px;
}

.sort-left .btn {
  margin-right: 5px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  background-color: white;
  color: #333;
}

.sort-left .btn.active {
  background-color: #337ab7;
  color: white;
  border-color: #337ab7;
}

.change-view {
  margin-bottom: 15px;
  font-size: 16px;
  color: #666;
}
</style>
