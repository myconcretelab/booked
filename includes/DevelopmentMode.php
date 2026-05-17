<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_DevelopmentMode
{
    public function register(): void
    {
        add_action('template_redirect', [$this, 'redirect_guest_requests'], 0);
        add_filter('rest_authentication_errors', [$this, 'require_login_for_rest']);
        add_action('send_headers', [$this, 'send_noindex_header']);
        add_action('login_init', [$this, 'send_noindex_header']);
    }

    public function redirect_guest_requests(): void
    {
        if (!$this->is_enabled() || is_user_logged_in() || is_admin() || wp_doing_ajax() || wp_doing_cron()) {
            return;
        }

        nocache_headers();
        wp_safe_redirect(wp_login_url($this->current_url()), 302);
        exit;
    }

    public function require_login_for_rest($result)
    {
        if (!empty($result) || !$this->is_enabled() || is_user_logged_in() || $this->is_allowed_machine_request()) {
            return $result;
        }

        return new WP_Error(
            'booked_development_mode_login_required',
            'Site en mode développement. Connexion requise.',
            ['status' => 401]
        );
    }

    public function send_noindex_header(): void
    {
        if (!$this->is_enabled() || headers_sent()) {
            return;
        }

        header('X-Robots-Tag: noindex, nofollow', false);
    }

    private function is_enabled(): bool
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);

        return is_array($settings) && !empty($settings['development_mode']);
    }

    private function is_allowed_machine_request(): bool
    {
        $route = $this->current_rest_route();
        if ($route === '' || strpos($route, '/booked/v1/') !== 0) {
            return false;
        }

        if ($route === '/booked/v1/webhooks/gite-photos' && $this->has_valid_webhook_signature()) {
            return true;
        }

        return $this->has_valid_integration_token();
    }

    private function current_rest_route(): string
    {
        $route = isset($_GET['rest_route']) ? (string) wp_unslash($_GET['rest_route']) : '';
        if ($route !== '') {
            return $this->normalize_rest_route($route);
        }

        $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';
        $path = (string) wp_parse_url($request_uri, PHP_URL_PATH);
        $prefix = '/' . trim(rest_get_url_prefix(), '/') . '/';
        $position = strpos($path, $prefix);
        if ($position === false) {
            return '';
        }

        return $this->normalize_rest_route(substr($path, $position + strlen($prefix)));
    }

    private function normalize_rest_route(string $route): string
    {
        $route = '/' . ltrim($route, '/');

        return $route === '/' ? $route : rtrim($route, '/');
    }

    private function has_valid_integration_token(): bool
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        $expected = trim((string) ($settings['integration_token'] ?? ''));
        if ($expected === '') {
            return false;
        }

        $authorization = $this->get_authorization_header();
        if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
            return false;
        }

        return hash_equals($expected, trim((string) $matches[1]));
    }

    private function has_valid_webhook_signature(): bool
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        $secret = trim((string) ($settings['webhook_secret'] ?? ''));
        if ($secret === '') {
            return false;
        }

        $timestamp = $this->get_header('x-booked-timestamp');
        $signature = $this->get_header('x-booked-signature');
        if ($timestamp === '' || $signature === '') {
            return false;
        }

        $time = strtotime($timestamp);
        if (!$time || abs(time() - $time) > 10 * MINUTE_IN_SECONDS) {
            return false;
        }

        $signature = preg_replace('/^sha256=/i', '', $signature);
        $body = file_get_contents('php://input');
        $expected = hash_hmac('sha256', $timestamp . '.' . (is_string($body) ? $body : ''), $secret);

        return is_string($signature) && hash_equals($expected, $signature);
    }

    private function get_authorization_header(): string
    {
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            if (is_array($headers)) {
                foreach ($headers as $name => $value) {
                    if (strtolower((string) $name) === 'authorization') {
                        return trim((string) $value);
                    }
                }
            }
        }

        return $this->get_header('authorization');
    }

    private function get_header(string $name): string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        if (isset($_SERVER[$key])) {
            return trim((string) wp_unslash($_SERVER[$key]));
        }

        if (strtolower($name) === 'content-type' && isset($_SERVER['CONTENT_TYPE'])) {
            return trim((string) wp_unslash($_SERVER['CONTENT_TYPE']));
        }

        if (strtolower($name) === 'authorization' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return trim((string) wp_unslash($_SERVER['REDIRECT_HTTP_AUTHORIZATION']));
        }

        return '';
    }

    private function current_url(): string
    {
        $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';

        return home_url($request_uri);
    }
}
