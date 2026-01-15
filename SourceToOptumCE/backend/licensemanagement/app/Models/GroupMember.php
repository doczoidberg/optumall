<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class GroupMember extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'group_member';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'account_id', 'group_id'
        // ,'member_role'
    ];
    public function group(){
        return $this->belongsTo('App\Models\AccountGroup', 'group_id');
    }
    public function account(){
        return $this->belongsTo('App\Models\Account', 'account_id');
    }
}
