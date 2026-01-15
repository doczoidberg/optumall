<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateSessionStatTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('session_stat', function (Blueprint $table) {
            $table->engine = 'InnoDB';

            $table->integer('seat_id')->primary();
            $table->integer('license_id');
            $table->integer('account_id');
            $table->integer('node_id');
            $table->dateTime('start_time');
            $table->dateTime('hb_time');
            $table->dateTime('end_time')->nullable();

            $table->index('license_id', 'license_id');
            $table->index('account_id', 'account_id');
            $table->index('node_id', 'node_id');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('session_stat');
    }
}
