<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Block
{
    private Booked_Variables $variables;
    private const DEFAULT_HOLIDAY_COLOR = '#22c55e';
    private const DEFAULT_BRIDGE_COLOR = '#f97316';
    private const DEFAULT_SUMMER_COLOR = '#0ea5e9';

    public function __construct(Booked_Variables $variables)
    {
        $this->variables = $variables;
    }

    public function register(): void
    {
        add_action('init', [$this, 'register_block']);
        add_action('enqueue_block_editor_assets', [$this, 'enqueue_editor_assets']);
    }

    private function get_default_gite_id(): string
    {
        $post = get_post();
        if (!$post instanceof WP_Post) {
            return '';
        }

        return sanitize_text_field((string) get_post_meta($post->ID, Booked_PageVariables::DEFAULT_GITE_META_KEY, true));
    }

    private function resolve_gite_id(array $attributes): string
    {
        $gite_id = sanitize_text_field((string) ($attributes['giteId'] ?? ''));
        return $gite_id !== '' ? $gite_id : $this->get_default_gite_id();
    }

    private function normalize_color($value, string $fallback): string
    {
        $color = sanitize_hex_color((string) $value);
        return is_string($color) && $color !== '' ? $color : $fallback;
    }

    private function get_calendar_color_attributes(): array
    {
        return [
            'holidayColor' => [
                'type' => 'string',
                'default' => self::DEFAULT_HOLIDAY_COLOR,
            ],
            'bridgeColor' => [
                'type' => 'string',
                'default' => self::DEFAULT_BRIDGE_COLOR,
            ],
            'summerColor' => [
                'type' => 'string',
                'default' => self::DEFAULT_SUMMER_COLOR,
            ],
        ];
    }

    private function get_calendar_color_data_attributes(array $attributes): string
    {
        return sprintf(
            ' data-holiday-color="%s" data-bridge-color="%s" data-summer-color="%s"',
            esc_attr($this->normalize_color($attributes['holidayColor'] ?? self::DEFAULT_HOLIDAY_COLOR, self::DEFAULT_HOLIDAY_COLOR)),
            esc_attr($this->normalize_color($attributes['bridgeColor'] ?? self::DEFAULT_BRIDGE_COLOR, self::DEFAULT_BRIDGE_COLOR)),
            esc_attr($this->normalize_color($attributes['summerColor'] ?? self::DEFAULT_SUMMER_COLOR, self::DEFAULT_SUMMER_COLOR))
        );
    }

    public function register_block(): void
    {
        register_block_type('booked/widget', [
            'api_version' => 2,
            'title' => 'Booked',
            'category' => 'widgets',
            'icon' => 'calendar-alt',
            'description' => 'Calendrier de disponibilités pour un gîte.',
            'attributes' => [
                'giteId' => [
                    'type' => 'string',
                    'default' => '',
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
            ] + $this->get_calendar_color_attributes(),
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
                'cardColumns' => [
                    'type' => 'number',
                    'default' => 3,
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

        register_block_type('booked/booking-card', [
            'api_version' => 2,
            'title' => 'Booked Réservation',
            'category' => 'widgets',
            'icon' => 'calendar',
            'description' => 'Carte latérale de sélection des dates et demande de réservation.',
            'attributes' => [
                'giteId' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'months' => [
                    'type' => 'number',
                    'default' => 2,
                ],
                'showTravelers' => [
                    'type' => 'boolean',
                    'default' => true,
                ],
            ] + $this->get_calendar_color_attributes(),
            'render_callback' => [$this, 'render_booking_card_block'],
        ]);

        register_block_type('booked/accordion', [
            'api_version' => 2,
            'title' => 'Booked Accordéon',
            'category' => 'text',
            'icon' => 'menu-alt3',
            'description' => 'Accordéon animé avec le design Booked.',
            'attributes' => [
                'summary' => [
                    'type' => 'string',
                    'source' => 'html',
                    'selector' => '.booked-accordion__title',
                    'default' => 'Titre de l’accordéon',
                ],
                'open' => [
                    'type' => 'boolean',
                    'default' => false,
                ],
                'icon' => [
                    'type' => 'string',
                    'default' => '',
                ],
            ],
            'supports' => [
                'anchor' => true,
                'className' => true,
                'align' => true,
                'spacing' => [
                    'margin' => true,
                ],
            ],
            'style' => 'booked-widget',
            'script' => 'booked-accordion',
        ]);

        register_block_type('booked/text', [
            'api_version' => 2,
            'title' => 'Booked Texte',
            'category' => 'text',
            'icon' => 'editor-paragraph',
            'description' => 'Texte Gutenberg enrichi avec les variables publiques d’un gîte.',
            'attributes' => [
                'giteId' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'content' => [
                    'type' => 'string',
                    'default' => '',
                ],
                'placeholder' => [
                    'type' => 'string',
                    'default' => 'Rédigez votre texte Booked...',
                ],
            ],
            'supports' => [
                'align' => true,
                'anchor' => true,
                'className' => true,
                'color' => [
                    'background' => true,
                    'gradients' => true,
                    'text' => true,
                ],
                'spacing' => [
                    'margin' => true,
                    'padding' => true,
                ],
                'typography' => [
                    'fontSize' => true,
                    'lineHeight' => true,
                ],
            ],
            'render_callback' => [$this, 'render_text_block'],
        ]);
    }

    public function enqueue_editor_assets(): void
    {
        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');
        wp_enqueue_script('booked-accordion');
        wp_enqueue_script('booked-gite-info');

        wp_enqueue_script(
            'booked-block',
            BOOKED_PLUGIN_URL . 'assets/block.js',
            ['wp-api-fetch', 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-data', 'wp-edit-post', 'wp-element', 'wp-i18n', 'wp-plugins', 'booked-widget', 'booked-accordion', 'booked-gite-info'],
            '0.3.17',
            true
        );
        wp_enqueue_style('booked-block', BOOKED_PLUGIN_URL . 'assets/block.css', ['booked-widget'], '0.3.17');
    }

    public function render_block(array $attributes): string
    {
        $gite_id = $this->resolve_gite_id($attributes);
        if ($gite_id === '') {
            return '<div class="booked-widget booked-widget--error">Sélectionnez un gîte dans le bloc Booked ou dans les réglages de la page.</div>';
        }

        $months = max(1, min(12, (int) ($attributes['months'] ?? 2)));
        $show_title = !empty($attributes['showTitle']);
        $show_capacity = !empty($attributes['showCapacity']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-widget" data-gite-id="%s" data-months="%d" data-show-title="%s" data-show-capacity="%s"%s></div>',
            esc_attr($gite_id),
            $months,
            $show_title ? '1' : '0',
            $show_capacity ? '1' : '0',
            $this->get_calendar_color_data_attributes($attributes)
        );
    }

    public function render_booking_card_block(array $attributes): string
    {
        $gite_id = $this->resolve_gite_id($attributes);
        $months = max(1, min(12, (int) ($attributes['months'] ?? 2)));
        $show_travelers = !array_key_exists('showTravelers', $attributes) || !empty($attributes['showTravelers']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-booking-card" data-gite-id="%s" data-months="%d" data-show-travelers="%s"%s></div>',
            esc_attr($gite_id),
            $months,
            $show_travelers ? '1' : '0',
            $this->get_calendar_color_data_attributes($attributes)
        );
    }

    public function render_gite_info_block(array $attributes): string
    {
        $gite_id = $this->resolve_gite_id($attributes);
        if ($gite_id === '') {
            return '<div class="booked-gite-info booked-widget--error">Sélectionnez un gîte dans le bloc Booked Infos gîte ou dans les réglages de la page.</div>';
        }

        $layout = in_array((string) ($attributes['layout'] ?? 'list'), ['list', 'accordion', 'cards'], true)
            ? (string) $attributes['layout']
            : 'list';
        $card_columns = max(1, min(4, (int) ($attributes['cardColumns'] ?? 3)));
        $selected_section_ids = array_values(array_filter(array_map('sanitize_text_field', (array) ($attributes['selectedSectionIds'] ?? []))));
        $selected_group_ids = array_values(array_filter(array_map('sanitize_text_field', (array) ($attributes['selectedGroupIds'] ?? []))));
        $show_title = !empty($attributes['showTitle']);
        $show_section_titles = !empty($attributes['showSectionTitles']);
        $show_notes = !empty($attributes['showNotes']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-gite-info');

        return sprintf(
            '<div class="booked-gite-info" data-gite-id="%s" data-layout="%s" data-card-columns="%d" data-selected-section-ids="%s" data-selected-group-ids="%s" data-show-title="%s" data-show-section-titles="%s" data-show-notes="%s"></div>',
            esc_attr($gite_id),
            esc_attr($layout),
            $card_columns,
            esc_attr(wp_json_encode($selected_section_ids)),
            esc_attr(wp_json_encode($selected_group_ids)),
            $show_title ? '1' : '0',
            $show_section_titles ? '1' : '0',
            $show_notes ? '1' : '0'
        );
    }

    public function render_text_block(array $attributes): string
    {
        $gite_id = $this->resolve_gite_id($attributes);
        $content = (string) ($attributes['content'] ?? '');
        if (trim(wp_strip_all_tags($content)) === '') {
            return '';
        }

        $rendered = $gite_id === '' ? wp_kses_post($content) : $this->variables->render_text($content, $gite_id);

        return sprintf(
            '<p %s>%s</p>',
            get_block_wrapper_attributes(['class' => 'booked-text']),
            $rendered
        );
    }
}
