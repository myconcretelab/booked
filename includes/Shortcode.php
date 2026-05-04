<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_Shortcode
{
    public function register(): void
    {
        add_shortcode('booked_widget', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
    }

    public function register_assets(): void
    {
        wp_register_style('booked-widget', BOOKED_PLUGIN_URL . 'assets/widget.css', [], '0.1.0');
        wp_register_script('booked-widget', BOOKED_PLUGIN_URL . 'assets/widget.js', [], '0.1.0', true);
        wp_localize_script('booked-widget', 'BookedWidgetConfig', [
            'restUrl' => esc_url_raw(rest_url('booked/v1')),
            'debug' => !empty(get_option(BOOKED_OPTION_KEY, [])['debug_mode']),
        ]);
    }

    public function render_shortcode(array $atts = []): string
    {
        $atts = shortcode_atts([
            'gite_id' => '',
        ], $atts, 'booked_widget');

        $gite_id = sanitize_text_field((string) $atts['gite_id']);
        if ($gite_id === '') {
            return '<div class="booked-widget booked-widget--error">Attribut gite_id manquant.</div>';
        }

        wp_enqueue_style('booked-widget');
        wp_enqueue_script('booked-widget');

        return sprintf(
            '<div class="booked-widget" data-gite-id="%s"></div>',
            esc_attr($gite_id)
        );
    }
}
