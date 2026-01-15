<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateAppTables extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
		Schema::create('account', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('type')->default('0')->comment('0-individual');
		    $table->string('name', 500)->nullable();
		    $table->string('domain', 200)->nullable();
		    $table->string('origin', 200)->nullable();
		    $table->dateTime('_last_seen')->nullable();
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->unique('domain','domain');

		    $table->timestamps();

		});

		Schema::create('account_group', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('account_id');
		    $table->string('name', 2000);
		    $table->text('description')->nullable();
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->index('account_id','account_group_ibfk_1');

		    $table->timestamps();

		});

		Schema::create('account_member', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->integer('id');
		    $table->integer('account_id');
		    $table->integer('member_id');
		    $table->integer('member_role')->default('0')->comment('0-Normal');

		    $table->primary('id');

		    $table->index('account_id','account_id');
		    $table->index('member_id','member_id');

		    $table->timestamps();

		});

		Schema::create('group_member', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('group_id');
		    $table->integer('account_id');
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->index('account_id','account_id');
		    $table->index('group_id','group_member_ibfk_2');

		    $table->timestamps();

		});

		Schema::create('account_scheme', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('account_id');
		    $table->integer('scheme_id');

		    $table->index('account_id','academic_id');
		    $table->index('scheme_id','scheme_id');

		    $table->timestamps();

		});

		Schema::create('archive', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('type')->comment('0-general');
		    $table->integer('license_id')->default(null);
		    $table->integer('account_id')->default(null);
		    $table->dateTime('start')->default(null);
		    $table->dateTime('end')->default(null);
		    $table->string('first_name', 500)->default(null);
		    $table->string('last_name', 500)->default(null);
		    $table->string('email', 1000)->default(null);
		    $table->text('machine');
		    $table->string('user_agent', 2000)->default(null);
		    $table->text('data');
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->timestamps();

		});

		Schema::create('assignment', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('license_id');
		    $table->integer('account_id');
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->index('account_id','account_id');
		    $table->index('license_id','assignment_ibfk_1');

		    $table->timestamps();

		});

		Schema::create('config', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->string('key', 250);
		    $table->string('value', 500);
		    $table->string('description', 1000)->default(null);

		    $table->primary('key');

		    $table->timestamps();

		});

		Schema::create('identity', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('role')->default(0)->comment('0-normal');
		    $table->string('email', 250);
		    $table->string('user_name', 250)->nullable();
		    $table->string('first_name', 250);
		    $table->string('last_name', 250);
		    $table->string('password', 250);
		    $table->string('country', 250)->nullable();
		    $table->integer('account_id')->nullable();
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->unique('email','email');
		    $table->unique('user_name','user_name');

		    $table->index('account_id','account_id');

		    $table->timestamps();

		});

		Schema::create('ip_data', function(Blueprint $table) {
		    $table->engine = 'MyISAM';

		    $table->string('ip', 250);
		    $table->integer('provider')->comment('0-ipstack');
		    $table->text('data');
		    $table->dateTime('update_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->primary('ip');

		    $table->timestamps();

		});

		Schema::create('license', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('owner_id')->nullable();
		    $table->integer('link_id')->nullable();
		    $table->integer('product_id');
		    $table->integer('seat_limit');
		    $table->integer('user_seat_limit');
		    $table->integer('node_limit');
		    $table->integer('instance_limit')->default('1');
		    $table->tinyInteger('life_cycle')->comment('0-Time limited, 1-Perpetual');
		    $table->dateTime('support_until')->nullable();
		    $table->string('releases', 1000)->nullable();
		    $table->dateTime('expiry_date');
		    $table->integer('scheme_id')->nullable();
		    $table->integer('lease_duration')->nullable()->comment('in seconds');
		    $table->string('features', 1000)->nullable();
		    $table->tinyInteger('type')->comment('0-named user, 1-floating');
		    $table->boolean('can_renewal')->nullable();
		    $table->boolean('auto_renewal')->default(0);
		    $table->tinyInteger('assignment_policy')->nullable()->comment('0-owner, 1-domains, 2-emails, 3-external');
		    $table->boolean('automatic_assign')->default(1);
		    $table->boolean('arbitrary_domain')->default(0);
		    $table->text('assignment_policy_data')->nullable();
		    $table->string('watermark', 100)->nullable();
		    $table->string('version_limit', 25)->nullable();
		    $table->string('description', 100)->nullable();
		    $table->string('text', 200)->nullable();
		    $table->integer('order_id')->nullable();
		    $table->dateTime('_lease_until')->nullable();
		    $table->boolean('notif')->nullable();
		    $table->string('notif_emails', 300)->nullable();
		    $table->text('notif_text')->nullable();
		    $table->string('notif_option', 50)->nullable();
		    $table->dateTime('notif_sent')->nullable();
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));
		    $table->string('sys_data', 100)->nullable();
		    $table->text('logs')->nullable();

		    $table->index('product_id','product_id');
		    $table->index('owner_id','owner_id');
		    $table->index('scheme_id','scheme_id');

		    $table->timestamps();

		});

		Schema::create('node', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('license_id');
		    $table->integer('account_id');
		    $table->text('machine');
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->index('license_id','license_id');
		    $table->index('account_id','account_id');

		    $table->timestamps();

		});

		Schema::create('product', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->string('code', 100);
		    $table->string('name', 25);
		    $table->string('description', 250);

		    $table->unique('code','code');

		    $table->timestamps();

		});

		Schema::create('product_release', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('product_id');
		    $table->string('name', 250);
		    $table->string('description', 200)->default(null);
		    $table->dateTime('start_date');

		    $table->index('product_id','product_id');

		    $table->timestamps();

		});

		Schema::create('scheme', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('product_id');
		    $table->string('name', 500);
		    $table->boolean('can_renewal')->default(null);
		    $table->text('description');
		    $table->integer('seat_limit')->default('1');
		    $table->integer('user_seat_limit')->default('1');
		    $table->integer('node_limit')->default('2');
		    $table->integer('type')->default('0')->comment('0-named user');
		    $table->integer('kind')->default('0')->comment('0-Trial');
		    $table->integer('assignment_policy')->default('0');
		    $table->integer('validity')->default(NULL);
		    $table->string('features', 1000)->default(null);
		    $table->string('text', 200)->default(null);

		    $table->index('product_id','product_id');

		    $table->timestamps();

		});

		Schema::create('seat', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->increments('id');
		    $table->integer('assignment_id');
		    $table->integer('node_id');
		    $table->dateTime('lease_since')->default(\DB::raw('CURRENT_TIMESTAMP'));
		    $table->dateTime('lease_until')->default(\DB::raw('CURRENT_TIMESTAMP'));
		    $table->string('user_agent', 2000)->default(null);
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));
		    $table->dateTime('update_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->index('node_id','node_id');
		    $table->index('assignment_id','assignment_id');

		    $table->timestamps();

		});

		Schema::create('user_location', function(Blueprint $table) {
		    $table->engine = 'InnoDB';

		    $table->integer('identity_id');
		    $table->string('first_country', 1000)->default(null);
		    $table->string('first_city', 1000)->default(null);
		    $table->integer('first_product_id')->default(null);
		    $table->string('last_country', 1000)->default(null);
		    $table->string('last_city', 1000)->default(null);
		    $table->integer('last_product_id')->default(null);
		    $table->dateTime('created_date')->default(\DB::raw('CURRENT_TIMESTAMP'));
		    $table->dateTime('update_date')->default(\DB::raw('CURRENT_TIMESTAMP'));

		    $table->primary('identity_id');

		    $table->timestamps();

		});


    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
		Schema::drop('user_location');
		Schema::drop('seat');
		Schema::drop('scheme');
		Schema::drop('product_release');
		Schema::drop('product');
		Schema::drop('node');
		Schema::drop('license');
		Schema::drop('ip_data');
		Schema::drop('identity');
		Schema::drop('config');
		Schema::drop('assignment');
		Schema::drop('archive');
		Schema::drop('group_member');
		Schema::drop('account_group');
		Schema::drop('account_scheme');
		Schema::drop('account_member');
		Schema::drop('account');

    }
}
