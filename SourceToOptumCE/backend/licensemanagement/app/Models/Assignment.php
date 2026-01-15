<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Assignment extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'assignment';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'license_id', 'account_id'
    ];
    // protected $appends = ['accountInfo'];
    // public function accountInfo(){
    //     return Account::where('id',$this->account_id)->first();
    // }
}
