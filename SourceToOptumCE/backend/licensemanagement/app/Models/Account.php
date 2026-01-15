<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Account extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'account';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'type', 'name', 'domain'
    ];
    protected $appends = ['totalMember','licenses','user'];
    public function getTotalMemberAttribute()
    {
        return 0;
        // return User::where('account_id', $this->id)->count();
    }
    public function getLicensesAttribute()
    {
         return License::with(['product'])->where('owner_id',$this->id)->get();
    }
    public function getUserAttribute()
    {
        return User::where('account_id', $this->id)->first();
    }

    /**
     * Get all members (account_member records) for this account
     */
    public function members()
    {
        return $this->hasMany(AccountMember::class, 'account_id');
    }
}
