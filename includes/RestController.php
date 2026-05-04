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
        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/config', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_config'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/gites', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_gites'],
            'permission_callback' => [$this, 'can_edit_posts'],
        ]);

        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/availability', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_availability'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/quote', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'post_quote'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/requests', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'post_request'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/settings/test', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'test_settings'],
            'permission_callback' => [$this, 'can_manage_options'],
        ]);
    }

    public function can_manage_options(): bool
    {
        return current_user_can('manage_options');
    }

    public function can_edit_posts(): bool
    {
        return current_user_can('edit_posts');
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

    public function get_gites(WP_REST_Request $request)
    {
        $result = $this->api_client->request('GET', '/booked/gites');
        if ($error = $this->maybe_error($result)) {
            return $error;
        }

        $items = $result['data'] ?? $result['gites'] ?? $result;
        if (!is_array($items)) {
            $items = [];
        }

        $gites = array_values(array_filter(array_map(static function ($item) {
            if (!is_array($item)) {
                return null;
            }

            $id = (string) ($item['id'] ?? $item['gite_id'] ?? $item['slug'] ?? '');
            if ($id === '') {
                return null;
            }

            return [
                'id' => $id,
                'name' => (string) ($item['nom'] ?? $item['name'] ?? $item['title'] ?? $id),
                'capacity' => isset($item['capacite_max']) ? (int) $item['capacite_max'] : (isset($item['capacity']) ? (int) $item['capacity'] : null),
            ];
        }, $items)));

        return new WP_REST_Response(['gites' => $gites], 200);
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

    public function test_settings(WP_REST_Request $request)
    {
        $result = $this->api_client->request('GET', '/booked/gites');
        if ($error = $this->maybe_error($result)) {
            return $error;
        }

        $items = $result['data'] ?? $result['gites'] ?? $result;
        $count = is_array($items) ? count($items) : 0;

        return new WP_REST_Response([
            'ok' => true,
            'message' => sprintf('Connexion API valide. %d gîte(s) détecté(s).', $count),
        ], 200);
    }
}
