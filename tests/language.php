<?php
// Standalone regression test: php tests/language.php
const ABSPATH = __DIR__;
const BOOKED_VERSION = 'test';
const MINUTE_IN_SECONDS = 60;
$locale = 'fr_FR';
$polylang = null;
$wpml = null;
$cache = [];
function get_locale() { return $GLOBALS['locale']; }
function pll_current_language($field) { return $GLOBALS['polylang']; }
function apply_filters($name, $value) { return $GLOBALS['wpml']; }
function sanitize_text_field($value) { return $value; }
function get_transient($key) { return $GLOBALS['cache'][$key] ?? false; }
function set_transient($key, $value, $ttl) { $GLOBALS['cache'][$key] = $value; }
function is_wp_error($value) { return false; }
class Booked_ApiClient {
    public array $requests = [];
    public function request($method, $path) { $this->requests[] = $path; return ['path' => $path]; }
}
require __DIR__ . '/../includes/Language.php';
require __DIR__ . '/../includes/Variables.php';
function check($actual, $expected) {
    if ($actual !== $expected) throw new RuntimeException(var_export([$actual, $expected], true));
}
check(Booked_Language::resolve(), 'fr');
check(Booked_Language::resolve('EN_gb'), 'en');
check(Booked_Language::resolve('es-ES'), 'es');
check(Booked_Language::resolve('de'), 'fr');
check(Booked_Language::resolve(['en']), 'fr');
$wpml = 'es';
check(Booked_Language::resolve(), 'es');
$polylang = 'en';
check(Booked_Language::resolve(), 'en');
$api = new Booked_ApiClient();
$variables = new Booked_Variables($api);
foreach (['fr', 'en', 'es', 'en'] as $language) {
    $polylang = $language;
    check($variables->get_gite_content('g1')['path'], '/booked/gites/g1/content?lang=' . $language);
}
check(count($api->requests), 3);
$polylang = 'fr';
check($variables->get_gite_content('g1', false, 'es')['path'], '/booked/gites/g1/content?lang=es');
echo "Language selection and cache isolation: OK\n";
