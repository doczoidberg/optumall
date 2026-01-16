<template>
<div id="page-wrapper" class="credits-page">
    <div class="container-fluid">
        <div class="row">
            <div class="col-lg-12">
                <h1 class="page-header">Credits</h1>
            </div>
        </div>

        <!-- Current Balance -->
        <div class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <div class="panel-heading">
                        <i class="fa fa-credit-card fa-fw"></i> Current Balance
                    </div>
                    <div class="panel-body">
                        <div class="balance-display" v-if="!balance.loading">
                            <div class="balance-info">
                                <span class="balance-label">Available Credits:</span>
                                <span class="balance-value">{{ currentBalance }}</span>
                            </div>
                            <div class="balance-details">
                                <span class="detail-item">
                                    <span class="detail-label">Total Purchased:</span>
                                    <span class="detail-value">{{ totalCredits }}</span>
                                </span>
                                <span class="detail-item">
                                    <span class="detail-label">Used:</span>
                                    <span class="detail-value">{{ creditsUsed }}</span>
                                </span>
                            </div>
                        </div>
                        <div v-else class="text-center">
                            <i class="fa fa-spinner fa-spin"></i> Loading balance...
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Credit Packages -->
        <div class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <div class="panel-heading">
                        <i class="fa fa-shopping-cart fa-fw"></i> Buy Credits
                    </div>
                    <div class="panel-body">
                        <div v-if="packages.loading" class="text-center">
                            <i class="fa fa-spinner fa-spin"></i> Loading packages...
                        </div>
                        <div v-else-if="packages.error" class="alert alert-danger">
                            {{ packages.error }}
                        </div>
                        <div v-else class="packages-grid">
                            <div
                                v-for="pkg in packages.items"
                                :key="pkg.id"
                                class="package-card"
                                :class="{ 'popular': pkg.id === 'professional' }"
                            >
                                <div class="package-header">
                                    <h3 class="package-name">{{ pkg.name }}</h3>
                                    <span v-if="pkg.id === 'professional'" class="popular-badge">Most Popular</span>
                                </div>
                                <div class="package-credits">
                                    <span class="credits-amount">{{ pkg.credits }}</span>
                                    <span class="credits-label">credits</span>
                                </div>
                                <div class="package-price">
                                    <span class="currency">$</span>
                                    <span class="amount">{{ pkg.price }}</span>
                                </div>
                                <div class="package-rate">
                                    ${{ (pkg.price / pkg.credits).toFixed(3) }} per credit
                                </div>
                                <button
                                    class="btn btn-primary btn-buy"
                                    :disabled="checkout.loading"
                                    @click="buyCredits(pkg.id)"
                                >
                                    <i v-if="checkout.loading" class="fa fa-spinner fa-spin"></i>
                                    <span v-else>Buy Now</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Transaction History -->
        <div class="row">
            <div class="col-lg-12">
                <div class="panel panel-default">
                    <div class="panel-heading">
                        <i class="fa fa-history fa-fw"></i> Transaction History
                    </div>
                    <div class="panel-body">
                        <div v-if="transactions.loading" class="text-center">
                            <i class="fa fa-spinner fa-spin"></i> Loading transactions...
                        </div>
                        <div v-else-if="transactions.items.length === 0" class="text-center text-muted">
                            No transactions yet
                        </div>
                        <div v-else class="table-responsive">
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Package</th>
                                        <th>Credits</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="tx in transactions.items" :key="tx.id">
                                        <td>{{ formatDate(tx.created_date) }}</td>
                                        <td>{{ tx.package_name }}</td>
                                        <td>{{ tx.credits }}</td>
                                        <td>${{ tx.amount }} {{ tx.currency }}</td>
                                        <td>
                                            <span
                                                class="label"
                                                :class="{
                                                    'label-success': tx.status === 'completed',
                                                    'label-warning': tx.status === 'pending',
                                                    'label-danger': tx.status === 'failed'
                                                }"
                                            >
                                                {{ tx.status }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'

export default {
    name: 'Credits',
    computed: {
        ...mapState({
            packages: state => state.credits.packages,
            balance: state => state.credits.balance,
            transactions: state => state.credits.transactions,
            checkout: state => state.credits.checkout
        }),
        ...mapGetters('credits', ['currentBalance', 'totalCredits', 'creditsUsed'])
    },
    created() {
        this.loadData();
    },
    methods: {
        ...mapActions('credits', ['getPackages', 'getBalance', 'getTransactions', 'createCheckoutSession']),

        loadData() {
            this.getPackages();
            this.getBalance();
            this.getTransactions();
        },

        buyCredits(packageId) {
            this.createCheckoutSession(packageId)
                .catch(error => {
                    this.$swal({
                        icon: 'error',
                        title: 'Checkout Error',
                        text: error.message || 'Failed to create checkout session'
                    });
                });
        },

        formatDate(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    }
}
</script>

<style scoped>
.credits-page {
    padding: 20px;
}

.balance-display {
    text-align: center;
    padding: 20px;
}

.balance-info {
    margin-bottom: 20px;
}

.balance-label {
    font-size: 18px;
    color: #666;
    display: block;
    margin-bottom: 10px;
}

.balance-value {
    font-size: 48px;
    font-weight: bold;
    color: #2c3e50;
}

.balance-details {
    display: flex;
    justify-content: center;
    gap: 40px;
}

.detail-item {
    display: flex;
    flex-direction: column;
}

.detail-label {
    font-size: 14px;
    color: #999;
}

.detail-value {
    font-size: 20px;
    font-weight: 600;
    color: #666;
}

.packages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    padding: 20px 0;
}

.package-card {
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    transition: all 0.3s ease;
    background: #fff;
}

.package-card:hover {
    border-color: #3498db;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.package-card.popular {
    border-color: #3498db;
    position: relative;
}

.package-header {
    margin-bottom: 16px;
}

.package-name {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: #2c3e50;
}

.popular-badge {
    display: inline-block;
    background: #3498db;
    color: #fff;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    margin-top: 8px;
}

.package-credits {
    margin-bottom: 12px;
}

.credits-amount {
    font-size: 36px;
    font-weight: bold;
    color: #2c3e50;
}

.credits-label {
    display: block;
    font-size: 14px;
    color: #999;
}

.package-price {
    margin-bottom: 8px;
}

.package-price .currency {
    font-size: 20px;
    vertical-align: top;
}

.package-price .amount {
    font-size: 32px;
    font-weight: bold;
    color: #27ae60;
}

.package-rate {
    font-size: 12px;
    color: #999;
    margin-bottom: 16px;
}

.btn-buy {
    width: 100%;
    padding: 12px;
    font-size: 16px;
    font-weight: 600;
}

.table th {
    background-color: #f8f9fa;
}

.label {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
}
</style>
