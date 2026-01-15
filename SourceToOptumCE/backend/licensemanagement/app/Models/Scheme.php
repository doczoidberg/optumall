<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Scheme extends Model
{

    // updated_at created_at
    public $timestamps = false;
    public $licenseIds = 0;
    protected $table = 'scheme';
	// 0-named user, 1-floating
    public const TYPES = [
        0 => 'named user',
        1 => 'floating'
     ];
    //  0-Trial, 1-Academic, 2-Commercial, 3-Custom Academic
     public const KINDS = [
        0 => 'Trial',
        1 => 'Free Academic',
        2 => 'Commercial',
        3 => 'VIP Academic'
     ];
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'product_id', 'name', 'can_renewal', 'description', 'seat_limit','user_seat_limit','node_limit','instance_limit','type','kind','assignment_policy','validity','features','text'
    ];
    protected $appends = ['typeDisplay','kindDisplay','seatAccounts', 'seatDisplay','availableSeats','activeUsers','contentVisible'];

    public function getAvailableSeatsAttribute()
    {
        $license_ids = License::where('scheme_id', $this->id)->pluck('id')->toArray();
        $this->licenseIds = $license_ids;
        $seat_used = Assignment::whereIn('license_id', $license_ids)->count();
        $availableSeats =  $this->seat_limit - $seat_used;
        return $availableSeats > 0 ? $availableSeats: 0;
    }
    public function getSeatDisplayAttribute()
    {
        return '-';
    }
    public function getSeatAccountsAttribute()
    {
        return [];
    }
    public function getActiveUsersAttribute()
    {
        return  '-';
        // return Assignment::whereIn('license_id', $this->licenseIds)->count();
    }
    public function getTypeDisplayAttribute()
    {
        return self::TYPES[ $this->attributes['type'] ];
    }
    public function getContentVisibleAttribute()
    {
        return false;
    }
    public function getKindDisplayAttribute()
    {
        if($this->name == "Commercial Pro"
        || $this->name == "Commercial Basic")
            return $this->name;
        return self::KINDS[ $this->attributes['kind'] ];
    }
    public function product(){
        return $this->belongsTo('App\Models\Product', 'product_id');
    }
}
