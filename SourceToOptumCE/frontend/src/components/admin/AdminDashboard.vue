<template>
<div id="page-wrapper" class="admin-overview-page">
    <div class="container-fluid">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header">Admin Dashboard</h1>
            </div>
        </div>
        
        <div v-if="loading" class="row" style="text-align: center; padding: 50px;">
            <div class="col-lg-12">
                <i class="fa fa-spinner fa-spin fa-3x"></i>
                <p>Loading statistics...</p>
            </div>
        </div>

        <div v-else-if="stats" class="row">
            <div class="col-lg-3 col-md-6">
                <div class="panel panel-primary">
                    <div class="panel-heading">
                        <div class="row">
                            <div class="col-xs-3">
                                <i class="fa fa-building fa-5x"></i>
                            </div>
                            <div class="col-xs-9 text-right">
                                <div class="huge">{{stats.total_accounts}}</div>
                                <div>Total Accounts</div>
                            </div>
                        </div>
                    </div>
                    <router-link to="/admin/accounts/grid">
                        <div class="panel-footer">
                            <span class="pull-left">View Accounts</span>
                            <span class="pull-right"><i class="fa fa-arrow-circle-right"></i></span>
                            <div class="clearfix"></div>
                        </div>
                    </router-link>
                </div>
            </div>

            <div class="col-lg-3 col-md-6">
                <div class="panel panel-green">
                    <div class="panel-heading">
                        <div class="row">
                            <div class="col-xs-3">
                                <i class="fa fa-users fa-5x"></i>
                            </div>
                            <div class="col-xs-9 text-right">
                                <div class="huge">{{stats.total_users}}</div>
                                <div>Total Users</div>
                            </div>
                        </div>
                    </div>
                    <router-link to="/admin/users/grid">
                        <div class="panel-footer">
                            <span class="pull-left">View Users</span>
                            <span class="pull-right"><i class="fa fa-arrow-circle-right"></i></span>
                            <div class="clearfix"></div>
                        </div>
                    </router-link>
                </div>
            </div>

            <div class="col-lg-3 col-md-6">
                <div class="panel panel-yellow">
                    <div class="panel-heading">
                        <div class="row">
                            <div class="col-xs-3">
                                <i class="fa fa-users fa-5x"></i>
                            </div>
                            <div class="col-xs-9 text-right">
                                <div class="huge">{{stats.total_groups}}</div>
                                <div>Total Groups</div>
                            </div>
                        </div>
                    </div>
                    <router-link to="/admin/group/grid">
                        <div class="panel-footer">
                            <span class="pull-left">View Groups</span>
                            <span class="pull-right"><i class="fa fa-arrow-circle-right"></i></span>
                            <div class="clearfix"></div>
                        </div>
                    </router-link>
                </div>
            </div>

            <div class="col-lg-3 col-md-6">
                <div class="panel panel-red">
                    <div class="panel-heading">
                        <div class="row">
                            <div class="col-xs-3">
                                <i class="fa fa-check-circle fa-5x"></i>
                            </div>
                            <div class="col-xs-9 text-right">
                                <div class="huge">{{stats.verified_users}}</div>
                                <div>Verified Users</div>
                            </div>
                        </div>
                    </div>
                    <a href="#">
                        <div class="panel-footer">
                            <span class="pull-left">{{verifiedPercentage}}% Verified</span>
                            <span class="pull-right"><i class="fa fa-arrow-circle-right"></i></span>
                            <div class="clearfix"></div>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        <div v-if="stats" class="row">
            <div class="col-lg-6">
                <div class="panel panel-default">
                    <div class="panel-heading">
                        <i class="fa fa-users fa-fw"></i> Users by Role
                    </div>
                    <div class="panel-body">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Role</th>
                                    <th class="text-right">Count</th>
                                    <th class="text-right">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(role, index) in stats.users_by_role" :key="'role-' + index">
                                    <td>{{role.role_name}}</td>
                                    <td class="text-right">{{role.count}}</td>
                                    <td class="text-right">{{((role.count / stats.total_users) * 100).toFixed(1)}}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="panel panel-default">
                    <div class="panel-heading">
                        <i class="fa fa-building fa-fw"></i> Accounts by Type
                    </div>
                    <div class="panel-body">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th class="text-right">Count</th>
                                    <th class="text-right">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(type, index) in stats.accounts_by_type" :key="'type-' + index">
                                    <td>{{type.type_name}}</td>
                                    <td class="text-right">{{type.count}}</td>
                                    <td class="text-right">{{((type.count / stats.total_accounts) * 100).toFixed(1)}}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="stats" class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <div class="panel-heading">
                        <i class="fa fa-info-circle fa-fw"></i> Additional Statistics
                    </div>
                    <div class="panel-body">
                        <div class="row">
                            <div class="col-lg-4">
                                <div class="stat-item">
                                    <h4>{{stats.two_factor_users}}</h4>
                                    <p>Users with 2FA Enabled</p>
                                    <small class="text-muted">{{twoFactorPercentage}}% of total users</small>
                                </div>
                            </div>
                            <div class="col-lg-4">
                                <div class="stat-item">
                                    <h4>{{stats.total_users - stats.verified_users}}</h4>
                                    <p>Unverified Users</p>
                                    <small class="text-muted">{{(100 - verifiedPercentage).toFixed(1)}}% of total users</small>
                                </div>
                            </div>
                            <div class="col-lg-4">
                                <div class="stat-item">
                                    <h4>{{averageUsersPerAccount}}</h4>
                                    <p>Avg Users per Account</p>
                                    <small class="text-muted">Based on current data</small>
                                </div>
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
import { httpClient } from '@/_helpers';

export default {
    name: 'AdminDashboard',
    data() {
        return {
            stats: null,
            loading: true,
            error: null
        }
    },
    created() {
        this.loadStats();
    },
    computed: {
        verifiedPercentage() {
            if (!this.stats || this.stats.total_users === 0) return 0;
            return ((this.stats.verified_users / this.stats.total_users) * 100).toFixed(1);
        },
        twoFactorPercentage() {
            if (!this.stats || this.stats.total_users === 0) return 0;
            return ((this.stats.two_factor_users / this.stats.total_users) * 100).toFixed(1);
        },
        averageUsersPerAccount() {
            if (!this.stats || this.stats.total_accounts === 0) return 0;
            return (this.stats.total_users / this.stats.total_accounts).toFixed(1);
        }
    },
    methods: {
        async loadStats() {
            try {
                this.loading = true;
                const response = await httpClient().get('api/admin/stats');
                if (response.success) {
                    this.stats = response.data;
                } else {
                    this.error = response.message || 'Failed to load statistics';
                }
            } catch (error) {
                console.error('Error loading stats:', error);
                this.error = 'Failed to load statistics';
            } finally {
                this.loading = false;
            }
        }
    }
}
</script>

<style scoped>
.huge {
    font-size: 40px;
    font-weight: bold;
}

.panel-green {
    border-color: #5cb85c;
}

.panel-green > .panel-heading {
    border-color: #5cb85c;
    color: white;
    background-color: #5cb85c;
}

.panel-green > a {
    color: #5cb85c;
}

.panel-green > a:hover {
    color: #3d8b3d;
}

.panel-red {
    border-color: #d9534f;
}

.panel-red > .panel-heading {
    border-color: #d9534f;
    color: white;
    background-color: #d9534f;
}

.panel-red > a {
    color: #d9534f;
}

.panel-red > a:hover {
    color: #b52b27;
}

.panel-yellow {
    border-color: #f0ad4e;
}

.panel-yellow > .panel-heading {
    border-color: #f0ad4e;
    color: white;
    background-color: #f0ad4e;
}

.panel-yellow > a {
    color: #f0ad4e;
}

.panel-yellow > a:hover {
    color: #df8a13;
}

.stat-item {
    text-align: center;
    padding: 20px;
}

.stat-item h4 {
    font-size: 32px;
    font-weight: bold;
    margin-bottom: 10px;
    color: #337ab7;
}

.stat-item p {
    font-size: 14px;
    margin-bottom: 5px;
}

.panel-footer {
    background-color: #f5f5f5;
}

.panel-footer a {
    text-decoration: none;
}
</style>
