<?php

namespace app\Console\Commands;

use Illuminate\Console\Command;
use DB;
use App\Crypto;
use App\AccountManager;
use App\AutoAssignment;
use App\AC;

class TestPhp extends Command
{
    protected $name = 'TestPhp';
    protected $description = "Test PHP";
    public function handle()
    {
        AC::accountRegister('hoongdt@gmail.com','DANG','HUNG' ,1);
        // AC::linkAccount('hoongdt@gmail.com');
    }

    public function pr($val)
    {
        if($val)
        $this->info('Yes');
        else
        $this->info('No');
    }

    protected function getOptions()
    {
        return [];
    }

}
