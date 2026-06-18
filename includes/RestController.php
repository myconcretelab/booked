<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_RestController
{
    private const PUBLIC_POST_BODY_LIMIT = 12000;
    private const QUOTE_RATE_LIMIT = 30;
    private const QUOTE_RATE_WINDOW = 60;
    private const REQUEST_RATE_LIMIT = 5;
    private const REQUEST_RATE_WINDOW = 10 * MINUTE_IN_SECONDS;

    private Booked_ApiClient $api_client;
    private Booked_Variables $variables;
    private Booked_PhotoSync $photo_sync;

    public function __construct(Booked_ApiClient $api_client, Booked_Variables $variables, Booked_PhotoSync $photo_sync)
    {
        $this->api_client = $api_client;
        $this->variables = $variables;
        $this->photo_sync = $photo_sync;
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

        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/photos', [
            'methods' => WP_REST_Server::READABLE,
            'callback' => [$this, 'get_photos'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('booked/v1', '/gites/(?P<id>[^/]+)/photos/sync', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'sync_photos'],
            'permission_callback' => [$this, 'can_edit_posts'],
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

        register_rest_route('booked/v1', '/webhooks/gite-photos', [
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => [$this, 'post_gite_photos_webhook'],
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

        $data = $result->get_error_data();
        $data = is_array($data) ? $data : [];
        $status = (int) ($data['status'] ?? 500);
        $is_admin_context = current_user_can('manage_options');
        $payload = $is_admin_context ? ($data['payload'] ?? null) : null;
        $message = $result->get_error_message();
        if (!$is_admin_context && ($status >= 500 || in_array($status, [401, 403], true))) {
            $message = 'Service Booked temporairement indisponible.';
        }

        $response = [
            'error' => $message,
        ];
        if ($payload !== null) {
            $response['details'] = $payload;
        }

        return new WP_REST_Response($response, $status);
    }

    private function get_client_identifier(): string
    {
        $keys = ['REMOTE_ADDR', 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR'];
        foreach ($keys as $key) {
            if (empty($_SERVER[$key])) {
                continue;
            }

            $value = (string) wp_unslash($_SERVER[$key]);
            $ip = trim(explode(',', $value)[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }

        return 'unknown';
    }

    private function check_rate_limit(string $scope, int $limit, int $window): ?WP_REST_Response
    {
        $key = 'booked_rate_' . md5($scope . '|' . $this->get_client_identifier());
        $count = (int) get_transient($key);
        if ($count >= $limit) {
            return new WP_REST_Response([
                'error' => 'Trop de requêtes. Réessayez dans quelques minutes.',
            ], 429);
        }

        set_transient($key, $count + 1, $window);

        return null;
    }

    private function validate_body_size(WP_REST_Request $request): ?WP_REST_Response
    {
        if (strlen((string) $request->get_body()) > self::PUBLIC_POST_BODY_LIMIT) {
            return new WP_REST_Response(['error' => 'Requête trop volumineuse.'], 413);
        }

        return null;
    }

    private function sanitize_public_payload($value, string $key = '')
    {
        if ($this->is_sensitive_public_key($key)) {
            return null;
        }

        if (is_array($value)) {
            $items = [];
            foreach ($value as $item_key => $item_value) {
                $safe_value = $this->sanitize_public_payload($item_value, is_string($item_key) ? $item_key : '');
                if ($safe_value === null) {
                    continue;
                }

                $items[$item_key] = $safe_value;
            }

            return $this->is_list_array($items) ? array_values($items) : $items;
        }

        if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
            return $value;
        }

        if (!is_scalar($value)) {
            return null;
        }

        $text = (string) $value;
        if ($this->is_url_key($key)) {
            return $this->sanitize_public_url($text);
        }

        return wp_kses_post($text);
    }

    private function is_list_array(array $value): bool
    {
        if ($value === []) {
            return true;
        }

        return array_keys($value) === range(0, count($value) - 1);
    }

    private function is_sensitive_public_key(string $key): bool
    {
        if ($key === '') {
            return false;
        }

        $key = strtolower($key);
        if (in_array($key, ['private_garden', 'private_courtyard'], true)) {
            return false;
        }

        return (bool) preg_match('/(^|[_-])(token|secret|password|passwd|pass|api[_-]?key|bearer|authorization|auth|private|internal|admin|owner|email|telephone|phone|tel|mobile|siret|iban|bic|stripe|paypal|notes?_internes?)([_-]|$)/', $key);
    }

    private function is_url_key(string $key): bool
    {
        return $key !== '' && (bool) preg_match('/(^|[_-])(url|uri|link|permalink)([_-]|$)/', strtolower($key));
    }

    private function sanitize_public_url(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        if (preg_match('#^https?://#i', $url)) {
            return esc_url_raw($url);
        }

        if (strpos($url, '/') === 0 && strpos($url, '//') !== 0) {
            return esc_url_raw($url);
        }

        return '';
    }

    private function sanitize_public_response($payload)
    {
        $sanitized = $this->sanitize_public_payload($payload);

        return is_array($sanitized) ? $sanitized : [];
    }

    private function sanitize_date_param($value): string
    {
        $value = sanitize_text_field((string) $value);

        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $matches)) {
            return '';
        }

        return checkdate((int) $matches[2], (int) $matches[3], (int) $matches[1]) ? $value : '';
    }

    private function sanitize_non_negative_int($value, int $max): int
    {
        return max(0, min($max, (int) $value));
    }

    private function sanitize_quote_options($options, int $travelers): array
    {
        if (!is_array($options)) {
            $options = [];
        }

        return [
            'draps' => [
                'enabled' => !empty($options['draps']['enabled']),
                'nb_lits' => $this->sanitize_non_negative_int($options['draps']['nb_lits'] ?? 0, 50),
            ],
            'linge_toilette' => [
                'enabled' => !empty($options['linge_toilette']['enabled']),
                'nb_personnes' => $this->sanitize_non_negative_int($options['linge_toilette']['nb_personnes'] ?? $travelers, 99),
            ],
            'menage' => [
                'enabled' => !empty($options['menage']['enabled']),
            ],
            'depart_tardif' => [
                'enabled' => !empty($options['depart_tardif']['enabled']),
            ],
            'chiens' => [
                'enabled' => !empty($options['chiens']['enabled']),
                'nb' => $this->sanitize_non_negative_int($options['chiens']['nb'] ?? 0, 10),
            ],
        ];
    }

    private function sanitize_quote_payload($payload)
    {
        if (!is_array($payload)) {
            return new WP_Error('booked_invalid_payload', 'Payload JSON invalide.', ['status' => 400]);
        }

        $date_entree = $this->sanitize_date_param($payload['date_entree'] ?? '');
        $date_sortie = $this->sanitize_date_param($payload['date_sortie'] ?? '');
        if ($date_entree === '' || $date_sortie === '' || strtotime($date_sortie) <= strtotime($date_entree)) {
            return new WP_Error('booked_invalid_dates', 'Dates de séjour invalides.', ['status' => 400]);
        }

        $adults = max(1, min(99, (int) ($payload['nb_adultes'] ?? 1)));
        $children = $this->sanitize_non_negative_int($payload['nb_enfants_2_17'] ?? 0, 99);
        $travelers = $adults + $children;

        return [
            'date_entree' => $date_entree,
            'date_sortie' => $date_sortie,
            'nb_adultes' => $adults,
            'nb_enfants_2_17' => $children,
            'options' => $this->sanitize_quote_options($payload['options'] ?? [], $travelers),
        ];
    }

    private function sanitize_booking_request_payload($payload)
    {
        $quote = $this->sanitize_quote_payload($payload);
        if (is_wp_error($quote)) {
            return $quote;
        }

        $gite_id = sanitize_text_field((string) ($payload['gite_id'] ?? ''));
        $name = sanitize_text_field((string) ($payload['hote_nom'] ?? ''));
        $phone = sanitize_text_field((string) ($payload['telephone'] ?? ''));
        $email = sanitize_email((string) ($payload['email'] ?? ''));

        if ($gite_id === '' || $name === '' || $phone === '' || $email === '' || !is_email($email)) {
            return new WP_Error('booked_invalid_request', 'Informations de contact invalides.', ['status' => 400]);
        }

        return array_merge($quote, [
            'gite_id' => $gite_id,
            'hote_nom' => $name,
            'telephone' => $phone,
            'email' => $email,
            'message_client' => sanitize_textarea_field((string) ($payload['message_client'] ?? '')),
        ]);
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
        return new WP_REST_Response($this->sanitize_public_response($result), 200);
    }

    public function get_content(WP_REST_Request $request)
    {
        $result = $this->api_client->request('GET', '/booked/gites/' . rawurlencode((string) $request['id']) . '/content');
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($this->sanitize_public_response($this->normalize_gite_content_response($result)), 200);
    }

    public function get_photos(WP_REST_Request $request)
    {
        $gite_id = sanitize_text_field((string) $request['id']);
        return new WP_REST_Response([
            'photos' => $this->photo_sync->get_public_photos($gite_id),
        ], 200);
    }

    public function sync_photos(WP_REST_Request $request)
    {
        $gite_id = sanitize_text_field((string) $request['id']);
        $result = $this->photo_sync->sync_gite_photos($gite_id);
        if (!empty($result['error'])) {
            return new WP_REST_Response([
                'ok' => false,
                'error' => $result['error'],
                'result' => $result,
            ], 502);
        }

        return new WP_REST_Response([
            'ok' => true,
            'result' => $result,
            'photos' => $this->photo_sync->get_public_photos($gite_id),
        ], 200);
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
            $from = $this->sanitize_date_param($request->get_param('from'));
            if ($from !== '') {
                $query['from'] = $from;
            }
        }
        if ($request->get_param('to')) {
            $to = $this->sanitize_date_param($request->get_param('to'));
            if ($to !== '') {
                $query['to'] = $to;
            }
        }
        $path = '/booked/gites/' . rawurlencode((string) $request['id']) . '/availability';
        if (!empty($query)) {
            $path .= '?' . http_build_query($query);
        }
        $result = $this->api_client->request('GET', $path);
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($this->sanitize_public_response($result), 200);
    }

    public function post_quote(WP_REST_Request $request)
    {
        if ($error = $this->validate_body_size($request)) {
            return $error;
        }
        if ($error = $this->check_rate_limit('quote:' . (string) $request['id'], self::QUOTE_RATE_LIMIT, self::QUOTE_RATE_WINDOW)) {
            return $error;
        }

        $payload = $this->sanitize_quote_payload($request->get_json_params());
        if (is_wp_error($payload)) {
            return $this->maybe_error($payload);
        }

        $result = $this->api_client->request(
            'POST',
            '/booked/gites/' . rawurlencode((string) $request['id']) . '/quote',
            $payload
        );
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($this->sanitize_public_response($result), 200);
    }

    public function post_request(WP_REST_Request $request)
    {
        if ($error = $this->validate_body_size($request)) {
            return $error;
        }
        if ($error = $this->check_rate_limit('request', self::REQUEST_RATE_LIMIT, self::REQUEST_RATE_WINDOW)) {
            return $error;
        }

        $payload = $this->sanitize_booking_request_payload($request->get_json_params());
        if (is_wp_error($payload)) {
            return $this->maybe_error($payload);
        }

        $result = $this->api_client->request('POST', '/booked/requests', $payload);
        if ($error = $this->maybe_error($result)) {
            return $error;
        }
        return new WP_REST_Response($this->sanitize_public_response($result), 201);
    }

    public function post_gite_photos_webhook(WP_REST_Request $request)
    {
        if (!$this->is_valid_webhook_request($request)) {
            return new WP_REST_Response(['error' => 'Signature webhook invalide.'], 401);
        }

        $payload = $request->get_json_params();
        $gite_id = sanitize_text_field((string) ($payload['gite_id'] ?? ''));
        if ($gite_id === '') {
            return new WP_REST_Response(['error' => 'gite_id manquant.'], 400);
        }

        $result = $this->photo_sync->sync_gite_photos($gite_id);
        if (!empty($result['error'])) {
            return new WP_REST_Response([
                'ok' => false,
                'gite_id' => $gite_id,
                'error' => $result['error'],
                'result' => $result,
            ], 502);
        }

        return new WP_REST_Response([
            'ok' => true,
            'queued' => false,
            'gite_id' => $gite_id,
            'result' => $result,
            'photos' => $this->photo_sync->get_public_photos($gite_id),
        ], 200);
    }

    private function is_valid_webhook_request(WP_REST_Request $request): bool
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        $secret = trim((string) ($settings['webhook_secret'] ?? ''));
        if ($secret === '') {
            return false;
        }

        $timestamp = trim((string) $request->get_header('x-booked-timestamp'));
        $signature = trim((string) $request->get_header('x-booked-signature'));
        if ($timestamp === '' || $signature === '') {
            return false;
        }

        $time = strtotime($timestamp);
        if (!$time || abs(time() - $time) > 10 * MINUTE_IN_SECONDS) {
            return false;
        }

        $signature = preg_replace('/^sha256=/i', '', $signature);
        $body = $request->get_body();
        $expected = hash_hmac('sha256', $timestamp . '.' . $body, $secret);

        if (!is_string($signature) || !hash_equals($expected, $signature)) {
            return false;
        }

        $replay_key = 'booked_webhook_replay_' . md5($timestamp . '.' . $body . '.' . $signature);
        if (get_transient($replay_key)) {
            return false;
        }

        set_transient($replay_key, 1, 10 * MINUTE_IN_SECONDS);

        return true;
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
