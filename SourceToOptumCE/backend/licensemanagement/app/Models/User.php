<?php

namespace App\Models;

use Illuminate\Auth\Authenticatable;
use Laravel\Lumen\Auth\Authorizable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Contracts\Auth\Access\Authorizable as AuthorizableContract;

use Illuminate\Notifications\Notifiable;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use DB;
use Log;

use Tymon\JWTAuth\Contracts\JWTSubject;
// use Illuminate\Database\Eloquent\SoftDeletes;
class User extends Model implements AuthenticatableContract, AuthorizableContract, JWTSubject, CanResetPasswordContract
{
    // SoftDeletes
    use Authenticatable, Authorizable, Notifiable, CanResetPassword;
    // updated_at created_at
    public $timestamps = false;
    protected $table = 'identity';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'role', 'email', 'user_name', 'first_name', 'last_name', 'country', 'account_id', 'created_date','two_factor_enabled', 'avatar', 'zipcode', 'street_number','street','city','region','phone_number', 'title', 'subscribe_email'
    ];
    protected $appends = ['roleName', 'avatarUrl', 'status', 'group', 'name','groupId', "organization"];
    /**
     * The attributes excluded from the model's JSON form.
     *
     * @var array
     */
    protected $hidden = ['password', 'remember_token'];


    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     *
     * @return mixed
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        return [];
    }
    public function getGroupAttribute()
    {

        $group_member = GroupMember::with(['group'])->where('account_id', $this->account_id)->first();
        if($group_member){
            return $group_member->group->name;
        }else{
            return '';
        }
    }

    public function getGroupIdAttribute()
    {

        $group_member = GroupMember::with(['group'])->where('account_id', $this->account_id)->first();
        if($group_member){
            return $group_member->group_id;
        }else{
            return 0;
        }
    }
    public function getNameAttribute()
    {
        return  $this->attributes['first_name'] . ' '. $this->attributes['last_name'];
    }
    public function getRoleNameAttribute()
    {
        if ($this->role == 2) return 'superadmin';
        return $this->role == 1 ? 'admin' : 'user';
    }
    public function getAvatarUrlAttribute()
    {
        $base_url = env('APP_URL', BASE_URL);
        return isset($this->attributes['avatar']) && $this->attributes['avatar'] != null ?  $base_url .'/uploads/avatar/'.$this->attributes['id']. '/' . $this->attributes['avatar'] :   $base_url .'/images/avatar_default_new.jpg';
    }
    public function getStatusAttribute()
    {
        return  isset($this->attributes['email_validated']) && $this->attributes['email_validated'] == 1 ? 'Active' : 'Invitation pending';
    }
    
    function fetchMemberData(){
        if ($this->member_data == NULL){
            $this->member_data = DB::table('account_member')
            ->join('account', 'account.id', '=', 'account_member.account_id')
            ->where('account_member.member_id', $this->account_id)
            ->orderBy("account_member.member_role", 'desc')
            ->select('account_member.id', 'account_member.member_role', 'account.name')
            ->first();
        }
    }
    private $member_data;

    public function getRoleAttribute()
    {
        // Check for super admin (identity.role = 2) first
        if (isset($this->attributes['role']) && $this->attributes['role'] == 2) {
            return 2;
        }
        $this->fetchMemberData();
        $isadmin = $this->member_data != NULL && $this->member_data->member_role == 1;
        return $isadmin?1:0;
    }
    public function getOrganizationAttribute()
    {
        $this->fetchMemberData();
        return $this->member_data != NULL ? $this->member_data->name : "";
    }

    /**
     * Get the account (organization) this user belongs to
     */
    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    /**
     * Get the group this user belongs to
     */
    public function group()
    {
        return $this->hasOneThrough(
            AccountGroup::class,
            GroupMember::class,
            'account_id', // Foreign key on group_member table
            'id',         // Foreign key on account_group table
            'account_id', // Local key on identity table
            'group_id'    // Local key on group_member table
        );
    }
}
