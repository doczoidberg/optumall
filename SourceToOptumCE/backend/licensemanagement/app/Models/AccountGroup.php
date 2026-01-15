<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;
// use Illuminate\Database\Eloquent\SoftDeletes;

class AccountGroup extends Model
{
    // use  SoftDeletes;
    // updated_at created_at
    public $timestamps = false;
    protected $table = 'account_group';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'account_id', 'name', 'description'
    ];
    protected $appends = ['totalMember','licenses', 'members'];
    public function getTotalMemberAttribute()
    {
        return GroupMember::where('group_id', $this->id)->count();
    }
    public function getLicensesAttribute()
    {
         return License::with(['product'])->where('owner_id',$this->account_id)->get();
    }
    public function getMembersAttribute()
    {
         return GroupMember::with(['account'])->where('group_id',$this->id)->get();
    }

    public function members(){
        return $this->hasMany('App\Models\GroupMember', 'group_id');
    }

    public function account(){
        return $this->belongsTo(Account::class, 'account_id');
    }
}
