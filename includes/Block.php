<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Block
{
    private Booked_Variables $variables;
    private Booked_ApiClient $api_client;
    private const DEFAULT_HOLIDAY_COLOR = '#22c55e';
    private const DEFAULT_BRIDGE_COLOR = '#f97316';
    private const DEFAULT_SUMMER_COLOR = '#0ea5e9';

    public function __construct(Booked_Variables $variables, Booked_ApiClient $api_client)
    {
        $this->variables = $variables;
        $this->api_client = $api_client;
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

    private function resolve_gite_id(array $attributes, bool $allow_page_block_fallback = false): string
    {
        $gite_id = sanitize_text_field((string) ($attributes['giteId'] ?? ''));
        if ($gite_id !== '') {
            return $gite_id;
        }

        $default_gite_id = $this->get_default_gite_id();
        if ($default_gite_id !== '') {
            return $default_gite_id;
        }

        return $allow_page_block_fallback ? $this->get_first_page_block_gite_id() : '';
    }

    private function get_first_page_block_gite_id(): string
    {
        $post = get_post();
        if (!$post instanceof WP_Post || trim((string) $post->post_content) === '') {
            return '';
        }

        return $this->find_gite_id_in_blocks(parse_blocks((string) $post->post_content));
    }

    private function find_gite_id_in_blocks(array $blocks): string
    {
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }

            $block_name = (string) ($block['blockName'] ?? '');
            if (strpos($block_name, 'booked/') === 0) {
                $gite_id = sanitize_text_field((string) ($block['attrs']['giteId'] ?? ''));
                if ($gite_id !== '') {
                    return $gite_id;
                }
            }

            $inner_blocks = is_array($block['innerBlocks'] ?? null) ? $block['innerBlocks'] : [];
            if (!empty($inner_blocks)) {
                $gite_id = $this->find_gite_id_in_blocks($inner_blocks);
                if ($gite_id !== '') {
                    return $gite_id;
                }
            }
        }

        return '';
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

    private function get_gallery_attributes(): array
    {
        return [
            'giteId' => [
                'type' => 'string',
                'default' => '',
            ],
            'columns' => [
                'type' => 'number',
                'default' => 3,
            ],
            'gap' => [
                'type' => 'number',
                'default' => 16,
            ],
            'imageRatio' => [
                'type' => 'string',
                'default' => '4-3',
            ],
            'layoutMode' => [
                'type' => 'string',
                'default' => 'grid',
            ],
            'featuredSideCount' => [
                'type' => 'number',
                'default' => 4,
            ],
            'hoverDimOpacity' => [
                'type' => 'number',
                'default' => 0,
            ],
            'lightbox' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'expandMode' => [
                'type' => 'string',
                'default' => 'lightbox',
            ],
            'widthMode' => [
                'type' => 'string',
                'default' => 'fixed',
            ],
            'maxWidth' => [
                'type' => 'number',
                'default' => 1200,
            ],
            'showCaptions' => [
                'type' => 'boolean',
                'default' => false,
            ],
        ];
    }

    private function get_image_carousel_attributes(): array
    {
        return [
            'images' => [
                'type' => 'array',
                'default' => [],
                'items' => ['type' => 'object'],
            ],
            'imageRatio' => [
                'type' => 'string',
                'default' => '4-3',
            ],
            'objectFit' => [
                'type' => 'string',
                'default' => 'cover',
            ],
            'transitionEffect' => [
                'type' => 'string',
                'default' => 'slide',
            ],
            'showDots' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'showArrows' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'autoplay' => [
                'type' => 'boolean',
                'default' => false,
            ],
            'pauseOnHover' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'interval' => [
                'type' => 'number',
                'default' => 4500,
            ],
            'showCaptions' => [
                'type' => 'boolean',
                'default' => false,
            ],
        ];
    }

    private function get_gallery_ratio_css(string $ratio): string
    {
        $ratios = [
            '1-1' => '1 / 1',
            '4-3' => '4 / 3',
            '3-2' => '3 / 2',
            '16-9' => '16 / 9',
            '2-3' => '2 / 3',
        ];

        return $ratios[$ratio] ?? $ratios['4-3'];
    }

    private function get_gite_cards_attributes(): array
    {
        return [
            'selectedGiteIds' => [
                'type' => 'array',
                'default' => [],
                'items' => ['type' => 'string'],
            ],
            'layout' => [
                'type' => 'string',
                'default' => 'grid',
            ],
            'woodFrameAssignments' => [
                'type' => 'object',
                'default' => [],
            ],
            'columns' => [
                'type' => 'number',
                'default' => 3,
            ],
            'imageRatio' => [
                'type' => 'string',
                'default' => '4-3',
            ],
            'showImages' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'showDescription' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'showStats' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'showCta' => [
                'type' => 'boolean',
                'default' => true,
            ],
            'ctaLabel' => [
                'type' => 'string',
                'default' => 'Voir le gîte',
            ],
        ];
    }

    private function get_all_gite_summaries(): array
    {
        $cached = get_transient('booked_gite_card_summaries');
        if (is_array($cached)) {
            return $cached;
        }

        $result = $this->api_client->request('GET', '/booked/gites');
        if (is_wp_error($result)) {
            return [];
        }

        $items = $result['data'] ?? $result['gites'] ?? $result;
        if (!is_array($items)) {
            return [];
        }

        $gites = array_values(array_filter(array_map(static function ($item) {
            if (!is_array($item)) {
                return null;
            }

            $id = sanitize_text_field((string) ($item['id'] ?? $item['gite_id'] ?? $item['slug'] ?? ''));
            if ($id === '') {
                return null;
            }

            return [
                'id' => $id,
                'name' => sanitize_text_field((string) ($item['nom'] ?? $item['name'] ?? $item['title'] ?? $id)),
                'capacity' => isset($item['capacite_max']) ? (int) $item['capacite_max'] : (isset($item['capacity']) ? (int) $item['capacity'] : null),
            ];
        }, $items)));

        set_transient('booked_gite_card_summaries', $gites, 10 * MINUTE_IN_SECONDS);

        return $gites;
    }

    private function sanitize_gite_id_list($value): array
    {
        return array_values(array_unique(array_filter(array_map('sanitize_text_field', (array) $value))));
    }

    private function get_gite_page_urls(array $gite_ids): array
    {
        $gite_ids = $this->sanitize_gite_id_list($gite_ids);
        if (empty($gite_ids)) {
            return [];
        }

        $post_types = get_post_types(['public' => true], 'names');
        unset($post_types['attachment']);
        if (empty($post_types)) {
            $post_types = ['page'];
        }

        $query = new WP_Query([
            'post_type' => array_values($post_types),
            'post_status' => 'publish',
            'posts_per_page' => -1,
            'no_found_rows' => true,
            'fields' => 'ids',
            'meta_query' => [
                [
                    'key' => Booked_PageVariables::DEFAULT_GITE_META_KEY,
                    'value' => $gite_ids,
                    'compare' => 'IN',
                ],
            ],
        ]);

        $urls = [];
        foreach ($query->posts as $post_id) {
            $gite_id = sanitize_text_field((string) get_post_meta((int) $post_id, Booked_PageVariables::DEFAULT_GITE_META_KEY, true));
            if ($gite_id === '' || isset($urls[$gite_id])) {
                continue;
            }

            $permalink = get_permalink((int) $post_id);
            if (is_string($permalink) && $permalink !== '') {
                $urls[$gite_id] = esc_url_raw($permalink);
            }
        }

        return $urls;
    }

    public function register_block(): void
    {
        foreach ([
            'booked-frame-rustic-dark' => 'Cadre bois rustique sombre',
            'booked-frame-antique-gold' => 'Cadre doré ancien',
            'booked-frame-ornate-wood' => 'Cadre bois orné',
        ] as $name => $label) {
            register_block_style('core/image', [
                'name' => $name,
                'label' => $label,
            ]);
        }

        wp_enqueue_block_style('core/image', [
            'handle' => 'booked-decorative',
            'src' => BOOKED_PLUGIN_URL . 'assets/decorative.css',
            'ver' => BOOKED_VERSION,
        ]);

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
                'showPeriodColors' => [
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
            'supports' => [
                'color' => [
                    'text' => true,
                ],
            ],
            'styles' => [
                [
                    'name' => 'compact-group-titles',
                    'label' => 'Titres de rubriques compacts',
                ],
                [
                    'name' => 'circle-text',
                    'label' => 'Texte en cercle',
                ],
            ],
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
                    'default' => ['__booked_no_selection__'],
                    'items' => ['type' => 'string'],
                ],
                'selectedGroupIds' => [
                    'type' => 'array',
                    'default' => ['__booked_no_selection__'],
                    'items' => ['type' => 'string'],
                ],
                'selectedGeneralInfoItemIds' => [
                    'type' => 'array',
                    'default' => ['__booked_no_selection__'],
                    'items' => ['type' => 'string'],
                ],
                'showTitle' => [
                    'type' => 'boolean',
                    'default' => false,
                ],
                'showSectionTitles' => [
                    'type' => 'boolean',
                    'default' => false,
                ],
                'showGroupTitles' => [
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

        register_block_type('booked/gallery', [
            'api_version' => 2,
            'title' => 'Booked Galerie',
            'category' => 'widgets',
            'icon' => 'format-gallery',
            'description' => 'Galerie des images publiques d’un gîte.',
            'supports' => [
                'align' => true,
                'anchor' => true,
                'className' => true,
                'spacing' => [
                    'margin' => true,
                    'padding' => true,
                ],
            ],
            'attributes' => $this->get_gallery_attributes(),
            'render_callback' => [$this, 'render_gallery_block'],
        ]);

        register_block_type('booked/image-carousel', [
            'api_version' => 2,
            'title' => 'Booked Image défilante',
            'category' => 'media',
            'icon' => 'format-gallery',
            'description' => 'Bloc image avec plusieurs photos, points de navigation, flèches discrètes et diaporama.',
            'supports' => [
                'align' => true,
                'anchor' => true,
                'className' => true,
                'spacing' => [
                    'margin' => true,
                    'padding' => true,
                ],
            ],
            'attributes' => $this->get_image_carousel_attributes(),
            'style' => 'booked-widget',
            'script' => 'booked-image-carousel',
        ]);

        register_block_type('booked/gite-cards', [
            'api_version' => 2,
            'title' => 'Booked Cards gîtes',
            'category' => 'widgets',
            'icon' => 'screenoptions',
            'description' => 'Cards de résumé pour comparer rapidement les gîtes sur la page d’accueil.',
            'supports' => [
                'align' => true,
                'anchor' => true,
                'className' => true,
                'spacing' => [
                    'margin' => true,
                    'padding' => true,
                ],
            ],
            'attributes' => $this->get_gite_cards_attributes(),
            'render_callback' => [$this, 'render_gite_cards_block'],
        ]);

        register_block_type('booked/booking-card', [
            'api_version' => 2,
            'title' => 'Booked Réservation',
            'category' => 'widgets',
            'icon' => 'calendar',
            'description' => 'Carte latérale de sélection des dates et demande de réservation.',
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

        register_block_type('booked/heading', [
            'api_version' => 2,
            'title' => 'Booked Titre',
            'category' => 'text',
            'icon' => 'heading',
            'description' => 'Titre décoratif avec séparateurs et plusieurs styles Booked.',
            'attributes' => [
                'content' => [
                    'type' => 'string',
                    'default' => 'Rez de chaussée',
                ],
                'level' => [
                    'type' => 'number',
                    'default' => 2,
                ],
                'headingStyle' => [
                    'type' => 'string',
                ],
                // Gutenberg owns `style` for color, spacing and typography;
                // strings remain accepted temporarily for legacy blocks.
                'style' => [
                    'type' => ['object', 'string'],
                ],
                'textAlign' => [
                    'type' => 'string',
                    'default' => 'center',
                ],
                'ribbonWidth' => [
                    'type' => 'string',
                    'default' => 'inline',
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
                    '__experimentalFontWeight' => true,
                    'fontSize' => true,
                    'lineHeight' => true,
                ],
            ],
            'style' => 'booked-widget',
            'render_callback' => [$this, 'render_heading_block'],
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
        wp_enqueue_script('booked-gallery');
        wp_enqueue_script('booked-gite-cards');
        wp_enqueue_script('booked-image-carousel');

        wp_enqueue_script(
            'booked-block',
            BOOKED_PLUGIN_URL . 'assets/block.js',
            ['wp-api-fetch', 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-data', 'wp-edit-post', 'wp-element', 'wp-i18n', 'wp-plugins', 'booked-widget', 'booked-accordion', 'booked-gite-info', 'booked-gallery', 'booked-gite-cards', 'booked-image-carousel'],
            BOOKED_VERSION,
            true
        );
        wp_enqueue_style('booked-block', BOOKED_PLUGIN_URL . 'assets/block.css', ['booked-widget'], BOOKED_VERSION);
    }

    public function render_heading_block(array $attributes): string
    {
        $content = (string) ($attributes['content'] ?? '');
        if (trim(wp_strip_all_tags($content)) === '') {
            return '';
        }
        $rendered_content = wp_kses($content, [
            'strong' => [],
            'b' => [],
            'mark' => [
                'class' => true,
                'style' => true,
            ],
        ]);

        $level = max(2, min(4, (int) ($attributes['level'] ?? 2)));
        $allowed_styles = [
            'line-ticks',
            'long-lines',
            'short-lines',
            'double-lines',
            'split-line',
            'corner-lines',
            'brackets',
            'underline',
            'overline',
            'marker',
            'ribbon',
            'boxed',
            'plain',
        ];
        $legacy_style = is_string($attributes['style'] ?? null) ? $attributes['style'] : '';
        $heading_style = (string) ($attributes['headingStyle'] ?? $legacy_style);
        $style = in_array($heading_style, $allowed_styles, true)
            ? $heading_style
            : 'line-ticks';
        $align = in_array((string) ($attributes['textAlign'] ?? 'center'), ['left', 'center', 'right'], true)
            ? (string) $attributes['textAlign']
            : 'center';
        $ribbon_width = ($attributes['ribbonWidth'] ?? 'inline') === 'full' ? 'full' : 'inline';
        $ribbon_width_class = $style === 'ribbon' ? sprintf(' booked-heading--ribbon-width-%s', $ribbon_width) : '';

        wp_enqueue_style('booked-widget');

        return sprintf(
            '<div %s><span class="booked-heading__line booked-heading__line--before" aria-hidden="true"></span><h%d class="booked-heading__text">%s</h%d><span class="booked-heading__line booked-heading__line--after" aria-hidden="true"></span></div>',
            get_block_wrapper_attributes([
                'class' => sprintf('booked-heading booked-heading--%s booked-heading--level-%d booked-heading--align-%s%s', $style, $level, $align, $ribbon_width_class),
            ]),
            $level,
            $rendered_content,
            $level
        );
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
        $show_period_colors = !array_key_exists('showPeriodColors', $attributes) || !empty($attributes['showPeriodColors']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-widget" data-gite-id="%s" data-months="%d" data-show-title="%s" data-show-capacity="%s" data-show-period-colors="%s"%s></div>',
            esc_attr($gite_id),
            $months,
            $show_title ? '1' : '0',
            $show_capacity ? '1' : '0',
            $show_period_colors ? '1' : '0',
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

        $wrapper_attributes = get_block_wrapper_attributes(['class' => 'booked-booking-card']);

        return sprintf(
            '<div %s data-gite-id="%s" data-months="%d" data-show-travelers="%s"%s></div>',
            $wrapper_attributes,
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
        $selected_general_info_item_ids = array_values(array_filter(array_map('sanitize_text_field', (array) ($attributes['selectedGeneralInfoItemIds'] ?? ['__booked_no_selection__']))));
        $show_title = !empty($attributes['showTitle']);
        $show_section_titles = !empty($attributes['showSectionTitles']);
        $show_group_titles = !array_key_exists('showGroupTitles', $attributes) || $attributes['showGroupTitles'] !== false;
        $show_notes = !empty($attributes['showNotes']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-gite-info');

        return sprintf(
            '<div %s data-gite-id="%s" data-layout="%s" data-card-columns="%d" data-selected-section-ids="%s" data-selected-group-ids="%s" data-selected-general-info-item-ids="%s" data-show-title="%s" data-show-section-titles="%s" data-show-group-titles="%s" data-show-notes="%s"></div>',
            get_block_wrapper_attributes(['class' => 'booked-gite-info']),
            esc_attr($gite_id),
            esc_attr($layout),
            $card_columns,
            esc_attr(wp_json_encode($selected_section_ids)),
            esc_attr(wp_json_encode($selected_group_ids)),
            esc_attr(wp_json_encode($selected_general_info_item_ids)),
            $show_title ? '1' : '0',
            $show_section_titles ? '1' : '0',
            $show_group_titles ? '1' : '0',
            $show_notes ? '1' : '0'
        );
    }

    public function render_gite_cards_block(array $attributes): string
    {
        $selected_gite_ids = $this->sanitize_gite_id_list($attributes['selectedGiteIds'] ?? []);
        $layout = in_array((string) ($attributes['layout'] ?? 'grid'), ['grid', 'compact', 'spotlight', 'page-compact', 'polaroid', 'wood-frames'], true)
            ? (string) $attributes['layout']
            : 'grid';
        $is_page_compact = $layout === 'page-compact';
        $gites = $is_page_compact && empty($selected_gite_ids) ? [] : $this->get_all_gite_summaries();
        $gite_ids = $selected_gite_ids;

        if ($is_page_compact) {
            $page_gite_id = $this->get_default_gite_id();
            if ($page_gite_id === '') {
                $page_gite_id = $this->get_first_page_block_gite_id();
            }
            $gite_ids = $page_gite_id !== '' ? [$page_gite_id] : array_slice($selected_gite_ids, 0, 1);
        } elseif (empty($gite_ids)) {
            $gite_ids = array_values(array_filter(array_map(static fn($gite) => (string) ($gite['id'] ?? ''), $gites)));
        }

        $columns = max(1, min(4, (int) ($attributes['columns'] ?? 3)));
        $image_ratio = in_array((string) ($attributes['imageRatio'] ?? '4-3'), ['1-1', '4-3', '3-2', '16-9'], true)
            ? (string) $attributes['imageRatio']
            : '4-3';
        $is_composed_layout = in_array($layout, ['polaroid', 'wood-frames'], true);
        $show_images = $is_composed_layout || (!$is_page_compact && (!array_key_exists('showImages', $attributes) || !empty($attributes['showImages'])));
        $show_description = $is_composed_layout || (!$is_page_compact && (!array_key_exists('showDescription', $attributes) || !empty($attributes['showDescription'])));
        $show_stats = $is_page_compact || $is_composed_layout || !array_key_exists('showStats', $attributes) || !empty($attributes['showStats']);
        $show_cta = !$is_page_compact && !$is_composed_layout && (!array_key_exists('showCta', $attributes) || !empty($attributes['showCta']));
        $allowed_frames = ['rustic', 'dark', 'patina', 'ornate', 'ancient', 'baroque', 'oval', 'gold', 'polaroid'];
        $wood_frame_assignments = [];
        foreach ((array) ($attributes['woodFrameAssignments'] ?? []) as $gite_id => $frame) {
            $gite_id = sanitize_text_field((string) $gite_id);
            $frame = sanitize_key((string) $frame);
            if ($gite_id !== '' && in_array($frame, $allowed_frames, true)) {
                $wood_frame_assignments[$gite_id] = $frame;
            }
        }
        $cta_label = sanitize_text_field((string) ($attributes['ctaLabel'] ?? 'Voir le gîte'));
        if ($cta_label === '') {
            $cta_label = 'Voir le gîte';
        }
        if ($is_page_compact) {
            $columns = 1;
        }

        $gite_lookup = [];
        foreach ($gites as $gite) {
            $id = (string) ($gite['id'] ?? '');
            if ($id !== '') {
                $gite_lookup[$id] = $gite;
            }
        }

        $page_urls = $is_page_compact ? [] : $this->get_gite_page_urls($gite_ids);
        $metadata = array_values(array_map(static function ($gite_id) use ($gite_lookup, $page_urls) {
            $gite = $gite_lookup[$gite_id] ?? [];

            return [
                'id' => $gite_id,
                'name' => (string) ($gite['name'] ?? $gite_id),
                'capacity' => $gite['capacity'] ?? null,
                'pageUrl' => (string) ($page_urls[$gite_id] ?? ''),
            ];
        }, $gite_ids));

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-gite-cards');

        $wrapper_attributes = get_block_wrapper_attributes([
            'class' => sprintf('booked-gite-cards booked-gite-cards--%s', $layout),
            'style' => sprintf('--booked-gite-cards-columns:%d;--booked-gite-cards-ratio:%s;', $columns, $this->get_gallery_ratio_css($image_ratio)),
        ]);

        return sprintf(
            '<div %s data-gite-ids="%s" data-gites="%s" data-layout="%s" data-columns="%d" data-image-ratio="%s" data-show-images="%s" data-show-description="%s" data-show-stats="%s" data-show-cta="%s" data-cta-label="%s" data-wood-frame-assignments="%s"></div>',
            $wrapper_attributes,
            esc_attr(wp_json_encode($gite_ids)),
            esc_attr(wp_json_encode($metadata)),
            esc_attr($layout),
            $columns,
            esc_attr($image_ratio),
            $show_images ? '1' : '0',
            $show_description ? '1' : '0',
            $show_stats ? '1' : '0',
            $show_cta ? '1' : '0',
            esc_attr($cta_label),
            esc_attr(wp_json_encode($wood_frame_assignments))
        );
    }

    public function render_gallery_block(array $attributes): string
    {
        $gite_id = $this->resolve_gite_id($attributes, true);
        $gite_name = '';
        foreach ($this->get_all_gite_summaries() as $gite) {
            if ((string) ($gite['id'] ?? '') === $gite_id) {
                $gite_name = (string) ($gite['name'] ?? '');
                break;
            }
        }
        $columns = max(1, min(6, (int) ($attributes['columns'] ?? 3)));
        $gap = max(0, min(64, (int) ($attributes['gap'] ?? 16)));
        $image_ratio = in_array((string) ($attributes['imageRatio'] ?? '4-3'), ['1-1', '4-3', '3-2', '16-9', '2-3'], true)
            ? (string) $attributes['imageRatio']
            : '4-3';
        $layout_mode = in_array((string) ($attributes['layoutMode'] ?? 'grid'), ['grid', 'featured', 'frames'], true)
            ? (string) $attributes['layoutMode']
            : 'grid';
        $featured_side_count = max(1, min(8, (int) ($attributes['featuredSideCount'] ?? 4)));
        $hover_dim_opacity = max(0, min(80, (int) ($attributes['hoverDimOpacity'] ?? 0)));
        $width_mode = in_array((string) ($attributes['widthMode'] ?? 'fixed'), ['fixed', 'full'], true)
            ? (string) $attributes['widthMode']
            : 'fixed';
        $max_width = max(320, min(2400, (int) ($attributes['maxWidth'] ?? 1200)));
        $lightbox = !array_key_exists('lightbox', $attributes) || !empty($attributes['lightbox']);
        $expand_mode = in_array((string) ($attributes['expandMode'] ?? 'lightbox'), ['lightbox', 'masonry'], true)
            ? (string) $attributes['expandMode']
            : 'lightbox';
        $show_captions = !empty($attributes['showCaptions']);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-gallery');

        $wrapper_attributes = get_block_wrapper_attributes([
            'class' => sprintf('booked-gallery booked-gallery--%s booked-gallery--layout-%s', $width_mode, $layout_mode),
            'style' => sprintf(
                '--booked-gallery-gap:%dpx;--booked-gallery-max-width:%dpx;--booked-gallery-ratio:%s;--booked-gallery-hover-dim-opacity:%s;',
                $gap,
                $max_width,
                $this->get_gallery_ratio_css($image_ratio),
                rtrim(rtrim(number_format($hover_dim_opacity / 100, 2, '.', ''), '0'), '.')
            ),
        ]);

        if ($gite_id === '') {
            return sprintf(
                '<div %s><div class="booked-gallery__empty">Sélectionnez un gîte dans le bloc Booked Galerie ou dans les réglages de la page.</div></div>',
                $wrapper_attributes
            );
        }

        return sprintf(
            '<div %s data-gite-id="%s" data-gite-name="%s" data-columns="%d" data-gap="%d" data-image-ratio="%s" data-layout-mode="%s" data-featured-side-count="%d" data-hover-dim-opacity="%d" data-lightbox="%s" data-expand-mode="%s" data-width-mode="%s" data-max-width="%d" data-show-captions="%s"></div>',
            $wrapper_attributes,
            esc_attr($gite_id),
            esc_attr($gite_name),
            $columns,
            $gap,
            esc_attr($image_ratio),
            esc_attr($layout_mode),
            $featured_side_count,
            $hover_dim_opacity,
            $lightbox ? '1' : '0',
            esc_attr($expand_mode),
            esc_attr($width_mode),
            $max_width,
            $show_captions ? '1' : '0'
        );
    }

    public function render_text_block(array $attributes): string
    {
        $gite_id = $this->resolve_gite_id($attributes, true);
        $content = (string) ($attributes['content'] ?? '');
        if (trim(wp_strip_all_tags($content)) === '') {
            return '';
        }

        $rendered = wp_kses_post(wpautop($this->variables->render_text($content, $gite_id)));

        return sprintf(
            '<div %s>%s</div>',
            get_block_wrapper_attributes(['class' => 'booked-text']),
            $rendered
        );
    }
}
