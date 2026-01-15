<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class UserLocation extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'user_location';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'identity_id', 'first_country', 'first_city','first_product_id','last_country','last_city','last_product_id'
    ];
}
