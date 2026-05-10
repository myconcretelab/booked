<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Variables
{
    private Booked_ApiClient $api_client;

    public function __construct(Booked_ApiClient $api_client)
    {
        $this->api_client = $api_client;
    }

    public function get_gite_content(string $gite_id)
    {
        $gite_id = sanitize_text_field($gite_id);
        if ($gite_id === '') {
            return new WP_Error('booked_missing_gite_id', 'Gîte manquant.', ['status' => 400]);
        }

        $cache_key = 'booked_gite_content_' . md5($gite_id);
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return $cached;
        }

        $result = $this->api_client->request('GET', '/booked/gites/' . rawurlencode($gite_id) . '/content');
        if (is_wp_error($result)) {
            return $result;
        }

        set_transient($cache_key, $result, 15 * MINUTE_IN_SECONDS);

        return $result;
    }

    public function render_text(string $html, string $gite_id): string
    {
        $content = $this->get_gite_content($gite_id);
        if (is_wp_error($content)) {
            return wp_kses_post($html);
        }

        return $this->replace_tokens($html, $content);
    }

    public function replace_tokens(string $html, array $content): string
    {
        $map = $this->get_replacement_map($content);

        $rendered = preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/', static function (array $matches) use ($map): string {
            $token = strtolower($matches[1]);

            return array_key_exists($token, $map) ? $map[$token] : $matches[0];
        }, $html);

        return wp_kses_post((string) $rendered);
    }

    public function get_variable_items(string $gite_id): array
    {
        $content = $this->get_gite_content($gite_id);
        if (is_wp_error($content)) {
            return [];
        }

        $variables = $this->get_replacement_map($content);
        $prefix = $this->find_prefix($content);
        $items = [];
        foreach ($variables as $token => $value) {
            if (substr($token, 0, 5) !== 'gite.') {
                continue;
            }

            $items[] = [
                'token' => '{{' . $token . '}}',
                'label' => $this->label_from_token($token),
                'preview' => wp_strip_all_tags($value),
            ];

            if ($prefix !== '') {
                $prefixed_token = $prefix . '.' . substr($token, 5);
                if (isset($variables[$prefixed_token])) {
                    $items[] = [
                        'token' => '{{' . $prefixed_token . '}}',
                        'label' => $this->label_from_token($prefixed_token),
                        'preview' => wp_strip_all_tags($value),
                    ];
                }
            }
        }

        usort($items, static function (array $a, array $b): int {
            return strnatcasecmp($a['label'], $b['label']);
        });

        return $items;
    }

    private function get_replacement_map(array $content): array
    {
        $flat = [];
        $this->flatten_scalars($content, '', $flat);

        $prefix = $this->find_prefix($content);
        $map = [];
        foreach ($flat as $path => $value) {
            $normalized_path = strtolower($path);
            $formatted = $this->format_value($value);

            $map[$normalized_path] = $formatted;
            $map['gite.' . $normalized_path] = $formatted;

            if ($prefix !== '') {
                $map[$prefix . '.' . $normalized_path] = $formatted;
            }
        }

        return $map;
    }

    private function flatten_scalars(array $value, string $prefix, array &$output): void
    {
        foreach ($value as $key => $item) {
            $key = $this->normalize_key((string) $key);
            if ($key === '') {
                continue;
            }

            $path = $prefix === '' ? $key : $prefix . '.' . $key;
            if ($this->should_skip_path($path)) {
                continue;
            }

            if (is_array($item)) {
                if ($this->is_list_of_scalars($item)) {
                    $output[$path] = implode(', ', array_map([$this, 'format_value'], $item));
                    continue;
                }

                $this->flatten_scalars($item, $path, $output);
                continue;
            }

            if (is_scalar($item) || $item === null) {
                $output[$path] = $item;
            }
        }
    }

    private function is_list_of_scalars(array $value): bool
    {
        if ($value === []) {
            return false;
        }

        foreach ($value as $item) {
            if (!(is_scalar($item) || $item === null)) {
                return false;
            }
        }

        return true;
    }

    private function should_skip_path(string $path): bool
    {
        $root = explode('.', $path)[0] ?? '';

        return in_array($root, ['sections', 'groupes'], true);
    }

    private function normalize_key(string $key): string
    {
        $key = remove_accents($key);
        $key = strtolower($key);
        $key = preg_replace('/[^a-z0-9_-]+/', '_', $key);

        return trim((string) $key, '_');
    }

    private function find_prefix(array $content): string
    {
        foreach (['prefixe', 'prefix', 'variable_prefix', 'variables_prefix'] as $key) {
            if (!empty($content[$key]) && is_scalar($content[$key])) {
                return $this->normalize_key((string) $content[$key]);
            }
        }

        return '';
    }

    private function format_value($value): string
    {
        if (is_bool($value)) {
            return $value ? 'Oui' : 'Non';
        }

        if ($value === null) {
            return '';
        }

        return (string) $value;
    }

    private function label_from_token(string $token): string
    {
        $label = preg_replace('/^gite\./', '', $token);
        $label = str_replace(['.', '_', '-'], ' ', (string) $label);

        return ucfirst($label);
    }
}
