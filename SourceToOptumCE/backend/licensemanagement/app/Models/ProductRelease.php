<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class ProductRelease extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'product_release';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'product_id', 'name', 'description', 'start_date'
    ];
}
