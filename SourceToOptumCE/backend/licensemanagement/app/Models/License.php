<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class License extends Model
{
    // 0-named user, 1-floating
        public const TYPES = [
            0 => 'named user',
            1 => 'floating'
         ];
    // life_cycle
    public const STATUS = [
        0 => 'Available',
        1 => 'Verification required',
        2 => 'Active',
        3 => 'Expired',
     ];
    // updated_at created_at
    public $timestamps = false;
    protected $table = 'license';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'owner_id', 'product_id', 'seat_limit', 'user_seat_limit','node_limit','instance_limit','life_cycle', 'support_until','releases','expiry_date', 'scheme_id', 'lease_duration','features', 'type', 'can_renewal','assignment_policy','automatic_assign','arbitrary_domain','assignment_policy_data','watermark','version_limit','description','text','order_id'
    ];
    public function product(){
        return $this->belongsTo('App\Models\Product', 'product_id');
    }
    public function account(){
        return $this->belongsTo('App\Models\Account', 'owner_id');
    }
    public function scheme(){
        return $this->belongsTo('App\Models\Scheme', 'scheme_id');
    }
    protected $appends = ['typeDisplay','availableSeats', 'available_domain', 'seatDisplay','seatAccounts','activeUsers','contentVisible','status','statusKey', 'groups','licenseEmails'];
    public function getTypeDisplayAttribute()
    {
        return self::TYPES[ $this->attributes['type'] ];
    }
    // availableSeats
    public function getAvailableSeatsAttribute()
    {
        $seat_used = Assignment::where('assignment.license_id', $this->id)->join('seat', 'seat.assignment_id', '=', 'assignment.id')->count();
        $availableSeats =  $this->seat_limit - $seat_used;
        return $availableSeats > 0 ? $availableSeats: 0;
    }
    public function getLicenseEmailsAttribute()
    {
        //return [];
        $now =  date('Y-m-d H:i:s');
        return Assignment::select('identity.email','assignment.account_id')->where('assignment.license_id', $this->id)->where('seat.lease_since','>',$now)->join('seat', 'seat.assignment_id', '=', 'assignment.id')->join('identity', 'identity.account_id', '=', 'assignment.account_id')->get();

    }

    public function getSeatAccountsAttribute()
    {
        //return [];
        $now =  date('Y-m-d H:i:s');
        $node_ids = Node::where('license_id', $this->id)->pluck('id')->toArray();
        $node_ids = array_unique($node_ids);
        $now =  date('Y-m-d H:i:s');
        return Seat::select('seat.id AS seat_id', 'account.name AS email', 'account.id AS accountId')
            ->whereIn('seat.node_id', $node_ids)
            ->where('seat.lease_until','>=',$now)
            ->join('assignment', 'seat.assignment_id', '=', 'assignment.id')
            ->join('account', 'assignment.account_id', '=', 'account.id')->get();
    }
    public function getAvailableDomainAttribute()
    {

        return $this->assignment_policy == 1 ? $this->assignment_policy_data : '';
    }

    public function getSeatDisplayAttribute()
    {
        $node_ids = Node::where('license_id', $this->id)->pluck('id')->toArray();
        $node_ids = array_unique($node_ids);
        $now =  date('Y-m-d H:i:s');
        $seat_available = Seat::select('id')->whereIn('node_id', $node_ids)->where('lease_until','>=',$now)->get()->count();
        return $this->seat_limit.'/'.$seat_available;
    }
    public function getStatusKeyAttribute()
    {
        $today = date("Y-m-d");
        $now = strtotime($today);
        $expiry_date = strtotime($this->expiry_date);
        if ($now <= $expiry_date) {
            // Actived
            return 2;
        }
        if($this->can_renewal == 1 & $expiry_date <= $now){
            // Verification required
            return 1;
        }
        if($this->can_renewal != 1 & $expiry_date <= $now){
            // expired
            return 3;
        }
        // Available
        return 0;
    }
    public function getStatusAttribute(){
        switch ($this->statusKey) {
            case 2:
                // Actived
                return '<span class="active">'.self::STATUS[2].'</span>';
            case 1:
                // Verification required
                return '<span class="verification">'.self::STATUS[1].'</span>';
            case 3:
                //expired
                return '<span class="expired">'.self::STATUS[3].'</span>';
            default:
                return '<span class="available">'.self::STATUS[0].'</span>';
        }
    }
    public function getGroupsAttribute(){
        $account_ids =  Assignment::where('license_id',$this->id)->pluck('account_id')->toArray();
        $account_ids = array_unique($account_ids);
        if(count($account_ids) == 0){
            return [];
        }
        $group_ids = GroupMember::whereIn('account_id',$account_ids)->pluck('group_id')->toArray();
        $group_ids = array_unique($group_ids);
        if(count($group_ids) == 0){
            return [];
        }
        return AccountGroup::whereIn('id',$group_ids)->pluck('name')->toArray();
    }
    public function accounts(){
        return $this->hasMany('App\Models\Assignment', 'license_id');
    }
    // activeUsers
    public function getActiveUsersAttribute()
    {
        $now =  date('Y-m-d H:i:s');
        return Assignment::where('assignment.license_id', $this->id)
        ->where('seat.lease_until','>',$now)
        ->join('seat', 'seat.assignment_id', '=', 'assignment.id')
        ->count();
    }
    public function getContentVisibleAttribute()
    {
        return false;
    }
    protected $casts = [
        'expiry_date'  => 'date:Y-m-d'
    ];
}
