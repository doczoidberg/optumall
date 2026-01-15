<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Archive extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'archive';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'type', 'license_id', 'account_id','start','end','first_name','last_name','email','machine','user_agent','data'
    ];
}
