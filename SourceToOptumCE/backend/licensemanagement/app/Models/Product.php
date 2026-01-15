<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;


class Product extends Model
{

    // updated_at created_at
    public $timestamps = false;
    protected $table = 'product';
    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'code', 'name', 'description', 'download_link'
    ];

    protected $appends = ['imageUrl','dowloadUrl'];

    public function getImageUrlAttribute()
    {
        $base_url = env('APP_URL', BASE_URL);
        return isset($this->code) && $this->code != null  ? $base_url.'/images/products/'. $this->code.'.png' :  $base_url.'/images/products/default.png';
    }
    public function getDowloadUrlAttribute()
    {
        return $this->download_link;
    }
}
