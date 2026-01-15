<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateNotificationTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('notification', function (Blueprint $table) {
            $table->engine = 'InnoDB';

            $table->increments('id');
            $table->integer('account_id');
            $table->string('type', 50)->nullable();
            $table->string('title', 250)->nullable();
            $table->text('message')->nullable();
            $table->boolean('read')->default(0);
            $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

            $table->timestamps();

            $table->index('account_id', 'account_id');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('notification');
    }
}
