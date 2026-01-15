<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class CreditTransaction extends Model
{
    public $timestamps = false;
    protected $table = 'credit_transactions';

    protected $fillable = [
        'account_id',
        'package_name',
        'credits',
        'amount',
        'currency',
        'status',
        'stripe_session_id',
        'stripe_payment_intent',
        'metadata',
        'completed_date'
    ];

    protected $casts = [
        'credits' => 'decimal:2',
        'amount' => 'decimal:2',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
