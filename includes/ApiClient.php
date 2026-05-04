<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_ApiClient
{
    public function get_settings(): array
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);

        return [
            'api_base_url' => rtrim((string) ($settings['api_base_url'] ?? ''), '/'),
            'integration_token' => trim((string) ($settings['integration_token'] ?? '')),
            'timeout_ms' => max(1000, (int) ($settings['timeout_ms'] ?? 10000)),
            'debug_mode' => !empty($settings['debug_mode']),
        ];
    }

    public function request(string $method, string $path, ?array $payload = null)
    {
        $settings = $this->get_settings();
        if ($settings['api_base_url'] === '' || $settings['integration_token'] === '') {
            return new WP_Error('booked_missing_settings', 'Booked n\'est pas configuré côté WordPress.', ['status' => 500]);
        }

        $url = $settings['api_base_url'] . '/api' . $path;
        $args = [
            'method' => strtoupper($method),
            'timeout' => $settings['timeout_ms'] / 1000,
            'headers' => [
                'Authorization' => 'Bearer ' . $settings['integration_token'],
                'Accept' => 'application/json',
            ],
        ];

        if ($payload !== null) {
            $args['headers']['Content-Type'] = 'application/json';
            $args['body'] = wp_json_encode($payload);
        }

        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) {
            return $response;
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if ($status >= 400) {
            $message = is_array($decoded) && !empty($decoded['error']) ? (string) $decoded['error'] : 'Erreur distante Booked.';
            return new WP_Error('booked_remote_error', $message, [
                'status' => $status,
                'payload' => is_array($decoded) ? $decoded : ['raw' => $body],
            ]);
        }

        return is_array($decoded) ? $decoded : [];
    }
}
