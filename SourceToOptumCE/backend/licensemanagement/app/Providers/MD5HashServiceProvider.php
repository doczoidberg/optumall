<?php
namespace App\Providers;

use App\Helpers\Hasher\MD5Hasher;

use Illuminate\Support\ServiceProvider;

class MD5HashServiceProvider extends ServiceProvider
{
    public function boot()
    {
        app('hash')->extend('md5', function () {
            return new Md5Hasher();
        });
    }
}