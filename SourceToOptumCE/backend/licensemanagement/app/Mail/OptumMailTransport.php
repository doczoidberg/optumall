<?php

namespace App\Mail;

use Illuminate\Mail\Transport\Transport;
use \Log;
use App\Http;

class OptumMailTransport extends Transport
{
    public function send(\Swift_Mime_SimpleMessage $message, &$failedRecipients = null)
    {
        $data = [];
        $fromField = $message->getFrom();
        if($fromField!= NULL && sizeof($fromField)>0){
            foreach ($fromField as $k => $v) {
                $data["From"]=$k; break;
            }
        }
        $toField = $message->getTo();
        if($toField!=NULL && sizeof($toField)>0){
            $data["To"]=[];
            foreach ($toField as $k => $v) {
                array_push($data["To"], $k);
            }
        }
        $ccField = $message->getCc();

        if($ccField!=NULL && sizeof($ccField)>0){
            $data["Cc"]=[];
            foreach ($ccField as $k => $v) {
                array_push($data["Cc"], $k);
            }
        }
        $bccField = $message->getBcc();
        if($bccField!=NULL && sizeof($bccField)>1){
            $data["Bcc"]=[];
            foreach ($bccField as $k => $v) {
                array_push($data["Bcc"], $k);
            }
        }
        $data["Subject"] = $message->getSubject();
        $data["IsHtml"] = str_contains($message->getBodyContentType(), "html");
        $data["Content"] = $message->getBody();

        // Log::info($data);
        Http::post2(env('OPTUM_MAILER_HOST') . "/mail/send", $data);

        return $this->numberOfRecipients($message);
    }
}