<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Node extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'node';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'license_id', 'account_id', 'machine'
    ];
}
