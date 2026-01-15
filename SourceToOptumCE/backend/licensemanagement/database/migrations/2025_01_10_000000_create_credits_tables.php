<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCreditsTables extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        // Credits balance table (no foreign keys for compatibility)
        Schema::create('account_credits', function (Blueprint $table) {
            $table->id();
            $table->integer('account_id')->unsigned();
            $table->decimal('credits', 10, 2)->default(0);
            $table->decimal('credits_used', 10, 2)->default(0);
            $table->timestamp('last_purchase_date')->nullable();
            $table->timestamp('created_date')->useCurrent();
            $table->timestamp('updated_date')->useCurrent()->useCurrentOnUpdate();

            $table->unique('account_id');
            $table->index('account_id');
        });

        // Credit transactions/purchases table
        Schema::create('credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->integer('account_id')->unsigned();
            $table->string('package_name', 100);
            $table->decimal('credits', 10, 2);
            $table->decimal('amount', 10, 2); // Price in USD/EUR
            $table->string('currency', 3)->default('USD');
            $table->string('status', 50)->default('pending'); // pending, completed, failed, refunded
            $table->string('stripe_session_id', 255)->nullable();
            $table->string('stripe_payment_intent', 255)->nullable();
            $table->text('metadata')->nullable(); // JSON metadata
            $table->timestamp('created_date')->useCurrent();
            $table->timestamp('completed_date')->nullable();

            $table->index('account_id');
            $table->index(['account_id', 'created_date']);
            $table->index('stripe_session_id');
        });

        // Credit usage logs (for VM or license usage tracking)
        Schema::create('credit_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->integer('account_id')->unsigned();
            $table->string('resource_type', 50); // 'vm', 'license', etc.
            $table->string('resource_id', 100); // VM ID, License ID, etc.
            $table->decimal('credits_used', 10, 2);
            $table->text('description')->nullable();
            $table->timestamp('created_date')->useCurrent();

            $table->index('account_id');
            $table->index(['account_id', 'created_date']);
            $table->index('resource_type');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('credit_usage_logs');
        Schema::dropIfExists('credit_transactions');
        Schema::dropIfExists('account_credits');
    }
}
