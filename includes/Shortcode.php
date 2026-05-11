<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Shortcode
{
    public function register(): void
    {
        add_shortcode('booked_widget', [$this, 'render_shortcode']);
        add_action('init', [$this, 'register_assets']);
    }

    public function register_assets(): void
    {
        wp_register_style('booked-widget', BOOKED_PLUGIN_URL . 'assets/widget.css', [], '0.3.9');
        wp_register_script('booked-widget', BOOKED_PLUGIN_URL . 'assets/widget.js', [], '0.3.7', true);
        wp_register_script('booked-accordion', BOOKED_PLUGIN_URL . 'assets/accordion.js', [], '0.3.8', true);
        wp_register_script('booked-gite-info', BOOKED_PLUGIN_URL . 'assets/gite-info.js', ['booked-widget', 'booked-accordion'], '0.3.9', true);
        wp_localize_script('booked-widget', 'BookedWidgetConfig', [
            'restUrl' => esc_url_raw(rest_url('booked/v1')),
            'debug' => !empty(get_option(BOOKED_OPTION_KEY, [])['debug_mode']),
        ]);
    }

    public function render_shortcode(array $atts = []): string
    {
        $atts = shortcode_atts([
            'gite_id' => '',
            'mode' => 'booking',
            'months' => '2',
            'show_title' => '1',
            'show_capacity' => '1',
        ], $atts, 'booked_widget');

        $gite_id = sanitize_text_field((string) $atts['gite_id']);
        if ($gite_id === '') {
            return '<div class="booked-widget booked-widget--error">Attribut gite_id manquant.</div>';
        }

        $mode = in_array((string) $atts['mode'], ['booking', 'calendar'], true) ? (string) $atts['mode'] : 'booking';
        $months = max(1, min(12, (int) $atts['months']));
        $show_title = filter_var($atts['show_title'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $show_capacity = filter_var($atts['show_capacity'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-widget" data-gite-id="%s" data-mode="%s" data-months="%d" data-show-title="%s" data-show-capacity="%s"></div>',
            esc_attr($gite_id),
            esc_attr($mode),
            $months,
            $show_title === false ? '0' : '1',
            $show_capacity === false ? '0' : '1'
        );
    }
}
