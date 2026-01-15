<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class AccountScheme extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'account_scheme';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'account_id', 'scheme_id'
    ];
}
