<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_RestController
{
    private Booked_ApiClient $api_client;
    private Booked_Variables $variables;

    public function __construct(Booked_ApiClient $api_client, Booked_Variables $variables)
    {
        $this->api_client = $api_client;
        $this->variables = $variables;
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

        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/content', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_content'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/variables', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_variables'],
            'permission_callback' => [$this, 'can_edit_posts'],
        ]);

        register_rest_route('booked/v1', '/variables', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_common_variables'],
            'permission_callback' => [$this, 'can_edit_posts'],
        ]);

        register_rest_route('booked/v1', '/gites', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_gites'],
            'permission_callback' => [$this, 'can_edit_posts'],
        ]);

        register_rest_route('booked/v1', '/dynamic-phrases', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_dynamic_phrases'],
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

    private function absolutize_remote_url(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        if (preg_match('#^https?://#i', $url)) {
            return esc_url_raw($url);
        }

        if (strpos($url, '//') === 0) {
            return esc_url_raw((is_ssl() ? 'https:' : 'http:') . $url);
        }

        $settings = $this->api_client->get_settings();
        $base_url = rtrim((string) ($settings['api_base_url'] ?? ''), '/');
        if ($base_url === '') {
            return esc_url_raw($url);
        }

        return esc_url_raw($base_url . '/' . ltrim($url, '/'));
    }

    private function normalize_gite_content_response(array $result): array
    {
        if (!isset($result['photos']) || !is_array($result['photos'])) {
            return $result;
        }

        $result['photos'] = array_values(array_filter(array_map(function ($photo) {
            if (!is_array($photo)) {
                return null;
            }

            $url = $this->absolutize_remote_url((string) ($photo['url'] ?? ''));
            if ($url === '') {
                return null;
            }

            return [
                'id' => sanitize_text_field((string) ($photo['id'] ?? md5($url))),
                'url' => $url,
                'title' => sanitize_text_field((string) ($photo['title'] ?? '')),
                'alt' => sanitize_text_field((string) ($photo['alt'] ?? '')),
                'credit' => sanitize_text_field((string) ($photo['credit'] ?? '')),
                'is_primary' => !empty($photo['is_primary']),
                'ordre' => isset($photo['ordre']) ? (int) $photo['ordre'] : 0,
            ];
        }, $result['photos'])));

        return $result;
    }

    public function get_config(WP_REST_Request $request)
    {
        $result = $this->api_client->request('GET', '/booked/gites/' . rawurlencode((string) $request['id']) . '/config');
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($result, 200);
    }

    public function get_content(WP_REST_Request $request)
    {
        $result = $this->api_client->request('GET', '/booked/gites/' . rawurlencode((string) $request['id']) . '/content');
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($this->normalize_gite_content_response($result), 200);
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
                'prefix' => (string) ($item['prefixe_contrat'] ?? $item['prefixe'] ?? $item['prefix'] ?? $item['variable_prefix'] ?? ''),
            ];
        }, $items)));

        return new WP_REST_Response(['gites' => $gites], 200);
    }

    public function get_variables(WP_REST_Request $request)
    {
        return new WP_REST_Response([
            'variables' => $this->variables->get_variable_items(
                (string) $request['id'],
                filter_var($request->get_param('refresh'), FILTER_VALIDATE_BOOLEAN)
            ),
        ], 200);
    }

    public function get_common_variables(WP_REST_Request $request)
    {
        return new WP_REST_Response([
            'variables' => $this->variables->get_common_variable_items(),
        ], 200);
    }

    public function get_dynamic_phrases(WP_REST_Request $request)
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        $phrases = is_array($settings['dynamic_phrases'] ?? null) ? $settings['dynamic_phrases'] : [];

        $items = array_values(array_filter(array_map(static function ($phrase) {
            if (!is_array($phrase)) {
                return null;
            }

            $token = str_replace(['{{', '}}'], '', (string) ($phrase['token'] ?? ''));
            $token = remove_accents($token);
            $token = strtolower($token);
            $token = trim((string) preg_replace('/[^a-z0-9_.-]+/', '_', $token), '_.-');
            $value = (string) preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/', static function (array $matches): string {
                $aliases = [
                    'gite.min_nuits_toute_annee' => 'gite.nb_nuits_minimum_toute_annee',
                    'gite.min_nuits_vacances_scolaires' => 'gite.nb_nuits_minimum_vacances_scolaires',
                    'gite.min_nuits_juillet_aout' => 'gite.nb_nuits_minimum_juillet_aout',
                ];
                $token = strtolower($matches[1]);

                return isset($aliases[$token]) ? '{{' . $aliases[$token] . '}}' : $matches[0];
            }, (string) ($phrase['value'] ?? ''));
            if ($token === '' || $value === '') {
                return null;
            }

            return [
                'title' => sanitize_text_field((string) ($phrase['title'] ?? $token)),
                'token' => '{{' . $token . '}}',
                'value' => wp_kses_post($value),
            ];
        }, $phrases)));

        return new WP_REST_Response(['phrases' => $items], 200);
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
