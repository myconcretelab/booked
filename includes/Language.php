<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Language
{
    public static function resolve($language = null): string
    {
        if ($language === null || $language === '') {
            $language = function_exists('pll_current_language') ? pll_current_language('slug') : null;
            if (!$language) {
                $language = apply_filters('wpml_current_language', null);
            }
            if (!$language) {
                $language = get_locale();
            }
        }
        $language = is_string($language) ? strtolower(str_replace('_', '-', $language)) : 'fr';
        $language = explode('-', $language)[0];
        return in_array($language, ['fr', 'en', 'es'], true) ? $language : 'fr';
    }
}
