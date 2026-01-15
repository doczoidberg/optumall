<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddMissingIdentityColumns extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('identity', function (Blueprint $table) {
            $table->boolean('email_validated')->default(false)->after('email');
            $table->boolean('subscribe_email')->default(false)->after('email_validated');
            $table->boolean('two_factor_enabled')->default(false)->after('subscribe_email');
            $table->softDeletes()->after('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('identity', function (Blueprint $table) {
            $table->dropColumn(['email_validated', 'subscribe_email', 'two_factor_enabled', 'deleted_at']);
        });
    }
}
