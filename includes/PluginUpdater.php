<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_PluginUpdater
{
    private const GITHUB_OWNER = 'myconcretelab';
    private const GITHUB_REPO = 'booked';
    private const CACHE_KEY = 'booked_github_latest_release';
    private const CACHE_TTL = 6 * HOUR_IN_SECONDS;

    public function register(): void
    {
        add_filter('pre_set_site_transient_update_plugins', [$this, 'check_for_update']);
        add_filter('plugins_api', [$this, 'plugin_information'], 10, 3);
        add_filter('upgrader_source_selection', [$this, 'normalize_package_directory'], 10, 4);
    }

    public function check_for_update($transient)
    {
        if (!is_object($transient)) {
            $transient = new stdClass();
        }

        $release = $this->get_latest_release();
        if (!$release || version_compare($release['version'], BOOKED_VERSION, '<=')) {
            return $transient;
        }

        $plugin = plugin_basename(BOOKED_PLUGIN_FILE);
        if (!isset($transient->response) || !is_array($transient->response)) {
            $transient->response = [];
        }

        $transient->response[$plugin] = (object) [
            'id' => $this->homepage_url(),
            'slug' => self::GITHUB_REPO,
            'plugin' => $plugin,
            'new_version' => $release['version'],
            'url' => $release['html_url'],
            'package' => $this->package_url($release['tag_name']),
            'tested' => $release['tested'],
            'requires' => $release['requires'],
        ];

        return $transient;
    }

    public function plugin_information($result, string $action, $args)
    {
        if ($action !== 'plugin_information' || empty($args->slug) || $args->slug !== self::GITHUB_REPO) {
            return $result;
        }

        $release = $this->get_latest_release();
        if (!$release) {
            return $result;
        }

        return (object) [
            'name' => 'Booked',
            'slug' => self::GITHUB_REPO,
            'version' => $release['version'],
            'author' => '<a href="https://github.com/' . esc_attr(self::GITHUB_OWNER) . '">Sebsoaz</a>',
            'homepage' => $this->homepage_url(),
            'download_link' => $this->package_url($release['tag_name']),
            'requires' => $release['requires'],
            'tested' => $release['tested'],
            'last_updated' => $release['published_at'],
            'sections' => [
                'description' => 'Widget de demande de réservation pour gîtes, relié à l\'application contrats.',
                'changelog' => $release['body'] !== '' ? wp_kses_post(nl2br($release['body'])) : 'Voir la release GitHub.',
            ],
        ];
    }

    public function normalize_package_directory(string $source, string $remote_source, $upgrader, ?array $hook_extra = null): string
    {
        if (empty($hook_extra['plugin']) || $hook_extra['plugin'] !== plugin_basename(BOOKED_PLUGIN_FILE)) {
            return $source;
        }

        $expected_source = trailingslashit($remote_source) . self::GITHUB_REPO;
        if (untrailingslashit($source) === untrailingslashit($expected_source)) {
            return $source;
        }

        if (file_exists($expected_source)) {
            return $source;
        }

        global $wp_filesystem;
        if (!$wp_filesystem) {
            return $source;
        }

        if (!$wp_filesystem->move($source, $expected_source, true)) {
            return $source;
        }

        return $expected_source;
    }

    private function get_latest_release(): ?array
    {
        $cached = get_site_transient(self::CACHE_KEY);
        if (is_array($cached)) {
            return $cached;
        }

        $response = wp_remote_get($this->api_url(), [
            'headers' => [
                'Accept' => 'application/vnd.github+json',
                'User-Agent' => 'Booked WordPress Plugin',
            ],
            'timeout' => 10,
        ]);

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return null;
        }

        $payload = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($payload) || empty($payload['tag_name'])) {
            return null;
        }

        $release = [
            'tag_name' => sanitize_text_field((string) $payload['tag_name']),
            'version' => ltrim(sanitize_text_field((string) $payload['tag_name']), 'vV'),
            'html_url' => esc_url_raw((string) ($payload['html_url'] ?? $this->homepage_url())),
            'published_at' => sanitize_text_field((string) ($payload['published_at'] ?? '')),
            'body' => (string) ($payload['body'] ?? ''),
            'requires' => '6.0',
            'tested' => '6.5',
        ];

        set_site_transient(self::CACHE_KEY, $release, self::CACHE_TTL);

        return $release;
    }

    private function api_url(): string
    {
        return sprintf(
            'https://api.github.com/repos/%s/%s/releases/latest',
            rawurlencode(self::GITHUB_OWNER),
            rawurlencode(self::GITHUB_REPO)
        );
    }

    private function package_url(string $tag_name): string
    {
        return sprintf(
            'https://github.com/%s/%s/archive/refs/tags/%s.zip',
            rawurlencode(self::GITHUB_OWNER),
            rawurlencode(self::GITHUB_REPO),
            rawurlencode($tag_name)
        );
    }

    private function homepage_url(): string
    {
        return sprintf(
            'https://github.com/%s/%s',
            rawurlencode(self::GITHUB_OWNER),
            rawurlencode(self::GITHUB_REPO)
        );
    }
}
