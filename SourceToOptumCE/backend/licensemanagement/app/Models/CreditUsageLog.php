<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class CreditUsageLog extends Model
{
    public $timestamps = false;
    protected $table = 'credit_usage_logs';

    protected $fillable = [
        'account_id',
        'resource_type',
        'resource_id',
        'credits_used',
        'description'
    ];

    protected $casts = [
        'credits_used' => 'decimal:2',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
