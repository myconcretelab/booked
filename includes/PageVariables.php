<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_PageVariables
{
    public const DEFAULT_GITE_META_KEY = '_booked_default_gite_id';

    private Booked_Variables $variables;

    public function __construct(Booked_Variables $variables)
    {
        $this->variables = $variables;
    }

    public function register(): void
    {
        add_action('init', [$this, 'register_post_meta']);
        add_filter('render_block', [$this, 'replace_default_gite_tokens'], 10, 2);
    }

    public function register_post_meta(): void
    {
        $post_types = get_post_types(['show_in_rest' => true], 'names');
        if (empty($post_types)) {
            $post_types = ['post', 'page'];
        }

        foreach ($post_types as $post_type) {
            register_post_meta($post_type, self::DEFAULT_GITE_META_KEY, [
                'auth_callback' => static function ($allowed, string $meta_key, int $post_id): bool {
                    return current_user_can('edit_post', $post_id);
                },
                'default' => '',
                'sanitize_callback' => 'sanitize_text_field',
                'show_in_rest' => true,
                'single' => true,
                'type' => 'string',
            ]);
        }
    }

    public function replace_default_gite_tokens(string $block_content, array $block): string
    {
        if ($block_content === '' || strpos($block_content, '{{') === false) {
            return $block_content;
        }

        $block_name = (string) ($block['blockName'] ?? '');
        if (strpos($block_name, 'booked/') === 0) {
            return $block_content;
        }

        $post = get_post();
        if (!$post instanceof WP_Post) {
            return $block_content;
        }

        $gite_id = sanitize_text_field((string) get_post_meta($post->ID, self::DEFAULT_GITE_META_KEY, true));
        if ($gite_id === '') {
            return $block_content;
        }

        return $this->variables->render_text($block_content, $gite_id);
    }
}
