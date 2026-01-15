<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class AccountMember extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'account_member';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    //member_role: 0-Normal, 1-Admin
    protected $fillable = [
        'member_role', 'account_id', 'member_id'
    ];
    // public function member(){
    //     return $this->belongsTo('App\Models\User','account_id' ,'account_id');
    // }

}
