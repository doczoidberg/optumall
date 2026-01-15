<?php

namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class AccountCredit extends Model
{
    public $timestamps = false;
    protected $table = 'account_credits';

    protected $fillable = [
        'account_id',
        'credits',
        'credits_used',
        'last_purchase_date'
    ];

    protected $casts = [
        'credits' => 'decimal:2',
        'credits_used' => 'decimal:2',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    /**
     * Get available credits
     */
    public function getAvailableCreditsAttribute()
    {
        return $this->credits - $this->credits_used;
    }

    /**
     * Add credits to account
     */
    public function addCredits($amount)
    {
        $this->credits += $amount;
        $this->last_purchase_date = now();
        $this->save();
    }

    /**
     * Deduct credits from account
     */
    public function deductCredits($amount)
    {
        if ($this->getAvailableCreditsAttribute() < $amount) {
            throw new \Exception('Insufficient credits');
        }
        $this->credits_used += $amount;
        $this->save();
    }
}
