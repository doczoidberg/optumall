<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Notification extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'notification';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'type', 'icon', 'title', 'body', 'member_id', 'ext_data'
    ];
    protected $appends = ['imageUrl'];

    public function getImageUrlAttribute()
    {
        $base_url = env('APP_URL', BASE_URL);
        return $this->icon ? $base_url.$this->icon :  '';
    }
}
