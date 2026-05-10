<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Variables
{
    private const VARIABLE_LABELS = [
        'adresse_complete' => 'Adresse complète',
        'horaire_arrivee' => 'Horaire d’arrivée',
        'horaire_depart' => 'Horaire de départ',
        'prix_nuit_basse_saison' => 'Prix/nuit basse saison',
        'prix_nuit_haute_saison' => 'Prix/nuit haute saison',
        'service_chiens_par_nuit' => 'Chiens / nuit',
        'service_depart_tardif_forfait' => 'Départ tardif forfait',
        'service_draps_par_lit' => 'Draps / lit',
        'service_linge_toilette_par_personne' => 'Linge toilette / personne',
        'service_menage_forfait' => 'Ménage forfait',
    ];

    private Booked_ApiClient $api_client;

    public function __construct(Booked_ApiClient $api_client)
    {
        $this->api_client = $api_client;
    }

    public function get_gite_content(string $gite_id, bool $force_refresh = false)
    {
        $gite_id = sanitize_text_field($gite_id);
        if ($gite_id === '') {
            return new WP_Error('booked_missing_gite_id', 'Gîte manquant.', ['status' => 400]);
        }

        $cache_key = 'booked_gite_content_' . md5($gite_id);
        $cached = $force_refresh ? false : get_transient($cache_key);
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

    public function get_variable_items(string $gite_id, bool $force_refresh = false): array
    {
        $content = $this->get_gite_content($gite_id, $force_refresh);
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

            $this->add_token_aliases($map, $normalized_path, $formatted, $prefix);
        }

        if (!empty($content['variables']) && is_array($content['variables'])) {
            $variable_flat = [];
            $this->flatten_scalars($content['variables'], '', $variable_flat);
            foreach ($variable_flat as $path => $value) {
                $this->add_token_aliases($map, strtolower($path), $this->format_value($value), $prefix);
            }
        }

        return $map;
    }

    private function add_token_aliases(array &$map, string $path, string $value, string $prefix): void
    {
        $map[$path] = $value;
        $map['gite.' . $path] = $value;

        if ($prefix !== '') {
            $map[$prefix . '.' . $path] = $value;
        }
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

        return in_array($root, ['sections', 'groupes', 'variables'], true);
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
        foreach (['prefixe_contrat', 'prefixe', 'prefix', 'variable_prefix', 'variables_prefix'] as $key) {
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
        $label = preg_replace('/^(gite|[a-z0-9_-]+)\./', '', $token);
        if (isset(self::VARIABLE_LABELS[$label])) {
            return self::VARIABLE_LABELS[$label];
        }

        $label = str_replace(['.', '_', '-'], ' ', (string) $label);

        return ucfirst($label);
    }
}
