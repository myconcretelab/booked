<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Shortcode
{
    private const DEFAULT_HOLIDAY_COLOR = '#22c55e';
    private const DEFAULT_BRIDGE_COLOR = '#f97316';
    private const DEFAULT_SUMMER_COLOR = '#0ea5e9';

    public function register(): void
    {
        add_shortcode('booked_widget', [$this, 'render_shortcode']);
        add_action('init', [$this, 'register_assets']);
    }

    public function register_assets(): void
    {
        wp_register_style('booked-decorative', BOOKED_PLUGIN_URL . 'assets/decorative.css', [], BOOKED_VERSION);
        wp_register_style('booked-widget', BOOKED_PLUGIN_URL . 'assets/widget.css', ['booked-decorative'], BOOKED_VERSION);
        wp_register_script('booked-widget', BOOKED_PLUGIN_URL . 'assets/widget.js', [], BOOKED_VERSION, true);
        wp_register_script('booked-accordion', BOOKED_PLUGIN_URL . 'assets/accordion.js', [], BOOKED_VERSION, true);
        wp_register_script('booked-gite-info', BOOKED_PLUGIN_URL . 'assets/gite-info.js', ['booked-widget', 'booked-accordion'], BOOKED_VERSION, true);
        wp_register_script('booked-gallery', BOOKED_PLUGIN_URL . 'assets/gallery.js', ['booked-widget'], BOOKED_VERSION, true);
        wp_register_script('booked-gite-cards', BOOKED_PLUGIN_URL . 'assets/gite-cards.js', ['booked-widget'], BOOKED_VERSION, true);
        wp_register_script('booked-image-carousel', BOOKED_PLUGIN_URL . 'assets/image-carousel.js', [], BOOKED_VERSION, true);
        wp_localize_script('booked-widget', 'BookedWidgetConfig', [
            'restUrl' => esc_url_raw(rest_url('booked/v1')),
            'debug' => !empty(get_option(BOOKED_OPTION_KEY, [])['debug_mode']),
            'woodFrameBaseUrl' => esc_url_raw(BOOKED_PLUGIN_URL . 'assets/images/'),
        ]);
    }

    public function render_shortcode(array $atts = []): string
    {
        $atts = shortcode_atts([
            'gite_id' => '',
            'months' => '2',
            'show_title' => '1',
            'show_capacity' => '1',
            'show_period_colors' => '1',
            'holiday_color' => self::DEFAULT_HOLIDAY_COLOR,
            'bridge_color' => self::DEFAULT_BRIDGE_COLOR,
            'summer_color' => self::DEFAULT_SUMMER_COLOR,
        ], $atts, 'booked_widget');

        $gite_id = sanitize_text_field((string) $atts['gite_id']);
        if ($gite_id === '') {
            return '<div class="booked-widget booked-widget--error">Attribut gite_id manquant.</div>';
        }

        $months = max(1, min(12, (int) $atts['months']));
        $show_title = filter_var($atts['show_title'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $show_capacity = filter_var($atts['show_capacity'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $show_period_colors = filter_var($atts['show_period_colors'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-widget" data-gite-id="%s" data-months="%d" data-show-title="%s" data-show-capacity="%s" data-show-period-colors="%s" data-holiday-color="%s" data-bridge-color="%s" data-summer-color="%s"></div>',
            esc_attr($gite_id),
            $months,
            $show_title === false ? '0' : '1',
            $show_capacity === false ? '0' : '1',
            $show_period_colors === false ? '0' : '1',
            esc_attr(sanitize_hex_color((string) $atts['holiday_color']) ?: self::DEFAULT_HOLIDAY_COLOR),
            esc_attr(sanitize_hex_color((string) $atts['bridge_color']) ?: self::DEFAULT_BRIDGE_COLOR),
            esc_attr(sanitize_hex_color((string) $atts['summer_color']) ?: self::DEFAULT_SUMMER_COLOR)
        );
    }
}
