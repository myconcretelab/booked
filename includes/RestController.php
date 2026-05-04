<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_RestController
{
    private Booked_ApiClient $api_client;

    public function __construct(Booked_ApiClient $api_client)
    {
        $this->api_client = $api_client;
    }

    public function register(): void
    {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes(): void
    {
        register_rest_route('booked/v1', '/gites/(?P<id>[A-Za-z0-9_-]+)/config', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_config'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/gites/(?P<id>[A-Za-z0-9_-]+)/availability', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_availability'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/gites/(?P<id>[A-Za-z0-9_-]+)/quote', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'post_quote'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/requests', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'post_request'],
            'permission_callback' => '__return_true',
        ]);
    }

    private function maybe_error($result)
    {
        if (!is_wp_error($result)) {
            return null;
        }

        $status = (int) ($result->get_error_data()['status'] ?? 500);
        $payload = $result->get_error_data()['payload'] ?? null;
        return new WP_REST_Response([
            'error' => $result->get_error_message(),
            'details' => $payload,
        ], $status);
    }

    public function get_config(WP_REST_Request $request)
    {
        $result = $this->api_client->request('GET', '/booked/gites/' . rawurlencode((string) $request['id']) . '/config');
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($result, 200);
    }

    public function get_availability(WP_REST_Request $request)
    {
        $query = [];
        if ($request->get_param('from')) {
            $query['from'] = sanitize_text_field((string) $request->get_param('from'));
        }
        if ($request->get_param('to')) {
            $query['to'] = sanitize_text_field((string) $request->get_param('to'));
        }
        $path = '/booked/gites/' . rawurlencode((string) $request['id']) . '/availability';
        if (!empty($query)) {
            $path .= '?' . http_build_query($query);
        }
        $result = $this->api_client->request('GET', $path);
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($result, 200);
    }

    public function post_quote(WP_REST_Request $request)
    {
        $result = $this->api_client->request(
            'POST',
            '/booked/gites/' . rawurlencode((string) $request['id']) . '/quote',
            $request->get_json_params()
        );
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($result, 200);
    }

    public function post_request(WP_REST_Request $request)
    {
        $result = $this->api_client->request('POST', '/booked/requests', $request->get_json_params());
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($result, 201);
    }
}
