<?php

if (!defined('ABSPATH')) {
    exit;
}

class Booked_SettingsPage
{
    public function register(): void
    {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_init', [$this, 'register_settings']);
    }

    public function register_menu(): void
    {
        add_options_page(
            'Booked',
            'Booked',
            'manage_options',
            'booked',
            [$this, 'render_page']
        );
    }

    public function register_settings(): void
    {
        register_setting(BOOKED_OPTION_KEY, BOOKED_OPTION_KEY, [$this, 'sanitize_settings']);
    }

    public function sanitize_settings(array $input): array
    {
        return [
            'api_base_url' => esc_url_raw((string) ($input['api_base_url'] ?? '')),
            'integration_token' => sanitize_text_field((string) ($input['integration_token'] ?? '')),
            'timeout_ms' => max(1000, (int) ($input['timeout_ms'] ?? 10000)),
            'debug_mode' => !empty($input['debug_mode']) ? 1 : 0,
        ];
    }

    public function render_page(): void
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        ?>
        <div class="wrap">
            <h1>Booked</h1>
            <form method="post" action="options.php">
                <?php settings_fields(BOOKED_OPTION_KEY); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="booked-api-base-url">URL de l'app contrats</label></th>
                        <td><input id="booked-api-base-url" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[api_base_url]" type="url" class="regular-text" value="<?php echo esc_attr($settings['api_base_url'] ?? ''); ?>" placeholder="https://contrats.example.com" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="booked-integration-token">Token d'intégration</label></th>
                        <td><input id="booked-integration-token" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[integration_token]" type="text" class="regular-text" value="<?php echo esc_attr($settings['integration_token'] ?? ''); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="booked-timeout-ms">Timeout API (ms)</label></th>
                        <td><input id="booked-timeout-ms" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[timeout_ms]" type="number" min="1000" step="500" value="<?php echo esc_attr((string) ($settings['timeout_ms'] ?? 10000)); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row">Debug</th>
                        <td>
                            <label>
                                <input name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[debug_mode]" type="checkbox" value="1" <?php checked(!empty($settings['debug_mode'])); ?> />
                                Activer les logs de débogage côté JS
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
