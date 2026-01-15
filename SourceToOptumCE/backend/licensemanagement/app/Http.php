<?php
namespace App;
class Http {
    public static function post($url, $fields=[])
    {
        $fields_string = http_build_query($fields);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fields_string);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FAILONERROR, false);
        $result = curl_exec($ch);
        $code = curl_getinfo($ch,CURLINFO_HTTP_CODE);
        $errNo =curl_errno($ch); 
        $errMsg = curl_error($ch);
        curl_close($ch);
        if ($errNo) {
            throw new \Exception($errMsg);
        }
        if($code>=400)
        throw new \Exception($result);

        return $result;
    }
    public static function post2($url, $fields=[])
    {
        $fields_string = json_encode($fields);
        $len = strlen($fields_string);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fields_string);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FAILONERROR, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json", 
            "Content-Length: ".$len,]);
            
        $result = curl_exec($ch);
        if (curl_errno($ch)) {
            $error_msg = curl_error($ch);
            throw new \Exception($error_msg);
        }
        curl_close($ch);
        return $result;
    }
    public static function get($url)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        // curl_setopt($ch, CURLOPT_GET, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FAILONERROR, false);
        $result = curl_exec($ch);
        if (curl_errno($ch)) {
            $error_msg = curl_error($ch);
            throw new \Exception($error_msg);
        }
        curl_close($ch);
        return $result;
    }
}