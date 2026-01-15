<?php
define('BASE_URL', 'https://account.optumce.com');
if (!function_exists('public_path')) {
   /**
    * Get the path to the public folder.
    *
    * @param  string $path
    * @return string
    */
    function public_path($path = '')
    {
        return env('PUBLIC_PATH', base_path('public')) . ($path ? '/' . $path : $path);
    }

}
if (!function_exists('get_string_between')) {
    /**
     * get a substring between two strings
     *
     * $fullstring = 'this is my [tag]dog[/tag]';
     * $parsed = get_string_between($fullstring, '[tag]', '[/tag]');
     * echo $parsed; // (result = dog)
     * @param  string $string  $start, $end
     * @return string
     */
    function get_string_between($string, $start, $end){
        $string = ' ' . $string;
        $ini = strpos($string, $start);
        if ($ini == 0) return '';
        $ini += strlen($start);
        $len = strpos($string, $end, $ini) - $ini;
        return substr($string, $ini, $len);
    }

 }

