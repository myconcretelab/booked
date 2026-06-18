<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_PhotoSync
{
    public const SYNC_HOOK = 'booked_sync_gite_photos';
    private const META_GITE_ID = '_booked_gite_id';
    private const META_PHOTO_ID = '_booked_photo_id';
    private const META_SOURCE_URL = '_booked_photo_source_url';
    private const META_HASH = '_booked_photo_hash';
    private const META_ORDER = '_booked_photo_order';
    private const META_IS_PUBLIC = '_booked_photo_is_public';
    private const META_CREDIT = '_booked_photo_credit';
    private const META_ORPHANED = '_booked_photo_orphaned';
    private const META_SYNCED_AT = '_booked_photo_synced_at';

    private Booked_ApiClient $api_client;

    public function __construct(Booked_ApiClient $api_client)
    {
        $this->api_client = $api_client;
    }

    public function register(): void
    {
        add_action(self::SYNC_HOOK, [$this, 'sync_gite_photos']);
    }

    public function schedule_sync(string $gite_id, int $delay = 30): bool
    {
        $gite_id = sanitize_text_field($gite_id);
        if ($gite_id === '') {
            return false;
        }

        $args = [$gite_id];
        $next = wp_next_scheduled(self::SYNC_HOOK, $args);
        if ($next) {
            wp_unschedule_event($next, self::SYNC_HOOK, $args);
        }

        return (bool) wp_schedule_single_event(time() + max(0, $delay), self::SYNC_HOOK, $args);
    }

    public function sync_gite_photos(string $gite_id): array
    {
        $gite_id = sanitize_text_field($gite_id);
        if ($gite_id === '') {
            return ['created' => 0, 'updated' => 0, 'replaced' => 0, 'orphaned' => 0, 'error' => 'Gîte manquant.'];
        }

        $content = $this->api_client->request('GET', '/booked/gites/' . rawurlencode($gite_id) . '/content');
        if (is_wp_error($content)) {
            return ['created' => 0, 'updated' => 0, 'replaced' => 0, 'orphaned' => 0, 'error' => $content->get_error_message()];
        }

        $photos = $this->normalize_remote_photos($content['photos'] ?? []);
        $existing = $this->get_attachment_ids_by_photo_id($gite_id);
        $seen_photo_ids = [];
        $counts = ['created' => 0, 'updated' => 0, 'replaced' => 0, 'orphaned' => 0, 'failed' => 0, 'error' => '', 'errors' => []];

        foreach ($photos as $index => $photo) {
            $photo_id = $photo['id'];
            $seen_photo_ids[$photo_id] = true;
            $attachment_id = (int) ($existing[$photo_id] ?? 0);

            if ($attachment_id > 0 && $this->should_replace_attachment($attachment_id, $photo)) {
                $replacement_id = $this->import_photo($gite_id, $photo);
                if (is_wp_error($replacement_id)) {
                    $counts['failed']++;
                    $counts['errors'][] = $this->format_import_error($photo, 'replace', $replacement_id);
                    continue;
                }

                wp_delete_attachment($attachment_id, true);
                $attachment_id = $replacement_id;
                $counts['replaced']++;
            }

            if ($attachment_id <= 0) {
                $attachment_id = $this->import_photo($gite_id, $photo);
                if (is_wp_error($attachment_id)) {
                    $counts['failed']++;
                    $counts['errors'][] = $this->format_import_error($photo, 'create', $attachment_id);
                    continue;
                }
                $counts['created']++;
            } else {
                $counts['updated']++;
            }

            $this->update_attachment_metadata($attachment_id, $gite_id, $photo, $index);
        }

        foreach ($existing as $photo_id => $attachment_id) {
            if (isset($seen_photo_ids[$photo_id])) {
                continue;
            }

            update_post_meta((int) $attachment_id, self::META_IS_PUBLIC, '0');
            update_post_meta((int) $attachment_id, self::META_ORPHANED, '1');
            update_post_meta((int) $attachment_id, self::META_SYNCED_AT, current_time('mysql', true));
            $counts['orphaned']++;
        }

        delete_transient($this->get_photos_cache_key($gite_id));

        return $counts;
    }

    public function get_public_photos(string $gite_id): array
    {
        $gite_id = sanitize_text_field($gite_id);
        if ($gite_id === '') {
            return [];
        }

        $cache_key = $this->get_photos_cache_key($gite_id);
        $cached = get_transient($cache_key);
        if (is_array($cached)) {
            return $cached;
        }

        $query = new WP_Query([
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'meta_query' => [
                'relation' => 'AND',
                [
                    'key' => self::META_GITE_ID,
                    'value' => $gite_id,
                ],
                [
                    'key' => self::META_IS_PUBLIC,
                    'value' => '1',
                ],
            ],
            'meta_key' => self::META_ORDER,
            'orderby' => [
                'meta_value_num' => 'ASC',
                'ID' => 'ASC',
            ],
        ]);

        $photos = array_values(array_filter(array_map([$this, 'format_attachment_photo'], $query->posts)));
        set_transient($cache_key, $photos, 15 * MINUTE_IN_SECONDS);

        return $photos;
    }

    private function get_photos_cache_key(string $gite_id): string
    {
        return 'booked_gite_photos_' . md5($gite_id);
    }

    private function normalize_remote_photos($photos): array
    {
        if (!is_array($photos)) {
            return [];
        }

        return array_values(array_filter(array_map(function ($photo) {
            if (!is_array($photo)) {
                return null;
            }

            $url = $this->absolutize_remote_url((string) ($photo['url'] ?? ''));
            $id = sanitize_text_field((string) ($photo['id'] ?? ''));
            if ($id === '' || $url === '') {
                return null;
            }

            return [
                'id' => $id,
                'url' => $url,
                'title' => sanitize_text_field((string) ($photo['title'] ?? '')),
                'alt' => sanitize_text_field((string) ($photo['alt'] ?? '')),
                'credit' => sanitize_text_field((string) ($photo['credit'] ?? '')),
                'is_primary' => !empty($photo['is_primary']),
                'ordre' => isset($photo['ordre']) ? (int) $photo['ordre'] : 0,
                'hash' => sanitize_text_field((string) ($photo['hash'] ?? md5($url))),
                'has_explicit_hash' => array_key_exists('hash', $photo) && (string) $photo['hash'] !== '',
            ];
        }, $photos)));
    }

    private function absolutize_remote_url(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        if (preg_match('#^https?://#i', $url)) {
            return $this->sanitize_remote_photo_url($url);
        }

        if (strpos($url, '//') === 0) {
            return $this->sanitize_remote_photo_url((is_ssl() ? 'https:' : 'http:') . $url);
        }

        $settings = $this->api_client->get_settings();
        $base_url = rtrim((string) ($settings['api_base_url'] ?? ''), '/');
        if ($base_url === '') {
            return '';
        }

        return $this->sanitize_remote_photo_url($base_url . '/' . ltrim($url, '/'));
    }

    private function sanitize_remote_photo_url(string $url): string
    {
        $url = esc_url_raw($url, ['http', 'https']);
        if ($url === '') {
            return '';
        }

        if (function_exists('wp_http_validate_url') && !wp_http_validate_url($url)) {
            return '';
        }

        $host = wp_parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return '';
        }

        if ($this->is_private_or_local_host($host)) {
            return '';
        }

        return $url;
    }

    private function is_private_or_local_host(string $host): bool
    {
        $host = strtolower(trim($host, '[]'));
        if ($host === 'localhost' || substr($host, -6) === '.local') {
            return true;
        }

        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return false;
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }

    private function get_attachment_ids_by_photo_id(string $gite_id): array
    {
        $query = new WP_Query([
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'meta_query' => [
                [
                    'key' => self::META_GITE_ID,
                    'value' => $gite_id,
                ],
            ],
        ]);

        $items = [];
        foreach ($query->posts as $attachment_id) {
            $photo_id = sanitize_text_field((string) get_post_meta((int) $attachment_id, self::META_PHOTO_ID, true));
            if ($photo_id !== '') {
                $items[$photo_id] = (int) $attachment_id;
            }
        }

        return $items;
    }

    private function should_replace_attachment(int $attachment_id, array $photo): bool
    {
        $source_url = (string) get_post_meta($attachment_id, self::META_SOURCE_URL, true);
        if ($source_url !== $photo['url']) {
            return true;
        }

        if (empty($photo['has_explicit_hash'])) {
            return false;
        }

        $hash = (string) get_post_meta($attachment_id, self::META_HASH, true);
        return $hash !== $photo['hash'];
    }

    private function import_photo(string $gite_id, array $photo)
    {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $safe_url = $this->sanitize_remote_photo_url((string) $photo['url']);
        if ($safe_url === '') {
            return new WP_Error(
                'booked_photo_url_rejected',
                'URL photo refusée.',
                [
                    'source_url' => $photo['url'],
                    'photo_id' => $photo['id'],
                ]
            );
        }

        $tmp = download_url($safe_url, 30);
        if (is_wp_error($tmp)) {
            return new WP_Error(
                'booked_photo_download_failed',
                sprintf('Téléchargement impossible: %s', $tmp->get_error_message()),
                [
                    'source_url' => $safe_url,
                    'photo_id' => $photo['id'],
                    'original_code' => $tmp->get_error_code(),
                    'original_data' => $tmp->get_error_data(),
                ]
            );
        }

        $path = parse_url($safe_url, PHP_URL_PATH);
        $filename = basename(is_string($path) && $path !== '' ? $path : $photo['id']);
        if (!preg_match('/\.(jpe?g|png|webp|avif)$/i', $filename)) {
            $filename .= '.jpg';
        }

        $file = [
            'name' => sanitize_file_name($gite_id . '-' . $photo['id'] . '-' . $filename),
            'tmp_name' => $tmp,
        ];

        $attachment_id = media_handle_sideload($file, 0, $photo['title'] ?: $photo['alt']);
        if (is_wp_error($attachment_id)) {
            @unlink($tmp);
            return new WP_Error(
                'booked_photo_media_failed',
                sprintf('Import média impossible: %s', $attachment_id->get_error_message()),
                [
                    'source_url' => $photo['url'],
                    'photo_id' => $photo['id'],
                    'filename' => $file['name'],
                    'original_code' => $attachment_id->get_error_code(),
                    'original_data' => $attachment_id->get_error_data(),
                ]
            );
        }

        return (int) $attachment_id;
    }

    private function format_import_error(array $photo, string $action, WP_Error $error): array
    {
        $data = $error->get_error_data();
        $details = is_array($data) ? $data : [];

        return [
            'photo_id' => (string) ($photo['id'] ?? ''),
            'title' => (string) ($photo['title'] ?? ''),
            'url' => (string) ($photo['url'] ?? ''),
            'action' => $action,
            'error_code' => $error->get_error_code(),
            'error_message' => $error->get_error_message(),
            'details' => $details,
        ];
    }

    private function update_attachment_metadata(int $attachment_id, string $gite_id, array $photo, int $fallback_order): void
    {
        wp_update_post([
            'ID' => $attachment_id,
            'post_title' => $photo['title'] !== '' ? $photo['title'] : $photo['id'],
            'post_excerpt' => $photo['credit'],
            'post_content' => '',
        ]);

        update_post_meta($attachment_id, '_wp_attachment_image_alt', $photo['alt']);
        update_post_meta($attachment_id, self::META_GITE_ID, $gite_id);
        update_post_meta($attachment_id, self::META_PHOTO_ID, $photo['id']);
        update_post_meta($attachment_id, self::META_SOURCE_URL, $photo['url']);
        update_post_meta($attachment_id, self::META_HASH, $photo['hash']);
        update_post_meta($attachment_id, self::META_ORDER, (string) ($photo['ordre'] >= 0 ? $photo['ordre'] : $fallback_order));
        update_post_meta($attachment_id, self::META_IS_PUBLIC, '1');
        update_post_meta($attachment_id, self::META_CREDIT, $photo['credit']);
        update_post_meta($attachment_id, self::META_ORPHANED, '0');
        update_post_meta($attachment_id, self::META_SYNCED_AT, current_time('mysql', true));
    }

    private function format_attachment_photo($attachment_id)
    {
        $attachment_id = (int) $attachment_id;
        $url = wp_get_attachment_image_url($attachment_id, 'large');
        if (!$url) {
            return null;
        }

        return [
            'id' => $attachment_id,
            'booked_photo_id' => (string) get_post_meta($attachment_id, self::META_PHOTO_ID, true),
            'url' => esc_url_raw($url),
            'full_url' => esc_url_raw(wp_get_attachment_image_url($attachment_id, 'full') ?: $url),
            'srcset' => wp_get_attachment_image_srcset($attachment_id, 'large') ?: '',
            'sizes' => wp_get_attachment_image_sizes($attachment_id, 'large') ?: '',
            'alt' => (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true),
            'title' => get_the_title($attachment_id),
            'credit' => (string) get_post_meta($attachment_id, self::META_CREDIT, true),
            'order' => (int) get_post_meta($attachment_id, self::META_ORDER, true),
        ];
    }
}
