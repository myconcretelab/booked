<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Block
{
    public function register(): void
    {
        add_action('init', [$this, 'register_block']);
        add_action('enqueue_block_editor_assets', [$this, 'enqueue_editor_assets']);
    }

    public function register_block(): void
    {
        register_block_type('booked/widget', [
            'api_version' => 2,
            'title' => 'Booked',
            'category' => 'widgets',
            'icon' => 'calendar-alt',
            'description' => 'Calendrier de disponibilités et demande de réservation pour un gîte.',
            'attributes' => [
                'giteId' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'mode' => [
                    'type' => 'string',
                    'default' => 'booking',
                ],
                'months' => [
                    'type' => 'number',
                    'default' => 2,
                ],
                'showTitle' => [
                    'type' => 'boolean',
                    'default' => true,
                ],
                'showCapacity' => [
                    'type' => 'boolean',
                    'default' => true,
                ],
            ],
            'render_callback' => [$this, 'render_block'],
        ]);

        register_block_type('booked/gite-info', [
            'api_version' => 2,
            'title' => 'Booked Infos gîte',
            'category' => 'widgets',
            'icon' => 'index-card',
            'description' => 'Liste d’équipements, chambres et infos publiques d’un gîte.',
            'attributes' => [
                'giteId' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'layout' => [
                    'type' => 'string',
                    'default' => 'list',
                ],
                'selectedSectionIds' => [
                    'type' => 'array',
                    'default' => [],
                    'items' => ['type' => 'string'],
                ],
                'selectedGroupIds' => [
                    'type' => 'array',
                    'default' => [],
                    'items' => ['type' => 'string'],
                ],
                'showTitle' => [
                    'type' => 'boolean',
                    'default' => true,
                ],
                'showSectionTitles' => [
                    'type' => 'boolean',
                    'default' => true,
                ],
                'showNotes' => [
                    'type' => 'boolean',
                    'default' => true,
                ],
            ],
            'render_callback' => [$this, 'render_gite_info_block'],
        ]);
    }

    public function enqueue_editor_assets(): void
    {
        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');
        wp_enqueue_script('booked-gite-info');

        wp_enqueue_script(
            'booked-block',
            BOOKED_PLUGIN_URL . 'assets/block.js',
            ['wp-api-fetch', 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-element', 'wp-i18n', 'booked-widget', 'booked-gite-info'],
            '0.3.4',
            true
        );
        wp_enqueue_style('booked-block', BOOKED_PLUGIN_URL . 'assets/block.css', ['booked-widget'], '0.3.4');
    }

    public function render_block(array $attributes): string
    {
        $gite_id = sanitize_text_field((string) ($attributes['giteId'] ?? ''));
        if ($gite_id === '') {
            return '<div class="booked-widget booked-widget--error">Sélectionnez un gîte dans le bloc Booked.</div>';
        }

        $mode = in_array((string) ($attributes['mode'] ?? 'booking'), ['booking', 'calendar'], true)
            ? (string) $attributes['mode']
            : 'booking';
        $months = max(1, min(12, (int) ($attributes['months'] ?? 2)));
        $show_title = !empty($attributes['showTitle']);
        $show_capacity = !empty($attributes['showCapacity']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-widget" data-gite-id="%s" data-mode="%s" data-months="%d" data-show-title="%s" data-show-capacity="%s"></div>',
            esc_attr($gite_id),
            esc_attr($mode),
            $months,
            $show_title ? '1' : '0',
            $show_capacity ? '1' : '0'
        );
    }

    public function render_gite_info_block(array $attributes): string
    {
        $gite_id = sanitize_text_field((string) ($attributes['giteId'] ?? ''));
        if ($gite_id === '') {
            return '<div class="booked-gite-info booked-widget--error">Sélectionnez un gîte dans le bloc Booked Infos gîte.</div>';
        }

        $layout = in_array((string) ($attributes['layout'] ?? 'list'), ['list', 'accordion', 'cards'], true)
            ? (string) $attributes['layout']
            : 'list';
        $selected_section_ids = array_values(array_filter(array_map('sanitize_text_field', (array) ($attributes['selectedSectionIds'] ?? []))));
        $selected_group_ids = array_values(array_filter(array_map('sanitize_text_field', (array) ($attributes['selectedGroupIds'] ?? []))));
        $show_title = !empty($attributes['showTitle']);
        $show_section_titles = !empty($attributes['showSectionTitles']);
        $show_notes = !empty($attributes['showNotes']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-gite-info');

        return sprintf(
            '<div class="booked-gite-info" data-gite-id="%s" data-layout="%s" data-selected-section-ids="%s" data-selected-group-ids="%s" data-show-title="%s" data-show-section-titles="%s" data-show-notes="%s"></div>',
            esc_attr($gite_id),
            esc_attr($layout),
            esc_attr(wp_json_encode($selected_section_ids)),
            esc_attr(wp_json_encode($selected_group_ids)),
            $show_title ? '1' : '0',
            $show_section_titles ? '1' : '0',
            $show_notes ? '1' : '0'
        );
    }
}
