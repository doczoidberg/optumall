<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Seat extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'seat';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'assignment_id', 'node_id', 'lease_since','lease_until','user_agent'
    ];
}
