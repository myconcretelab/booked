<?php
/**
 * Plugin Name: Booked
 * Description: Widget de demande de réservation pour gîtes, relié à l'application contrats.
 * Version: 0.3.93
 * Author: Sebsoaz
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BOOKED_PLUGIN_FILE', __FILE__);
define('BOOKED_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BOOKED_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BOOKED_OPTION_KEY', 'booked_settings');
define('BOOKED_VERSION', '0.3.93');

require_once BOOKED_PLUGIN_DIR . 'includes/ApiClient.php';
require_once BOOKED_PLUGIN_DIR . 'includes/Variables.php';
require_once BOOKED_PLUGIN_DIR . 'includes/PhotoSync.php';
require_once BOOKED_PLUGIN_DIR . 'includes/PageVariables.php';
require_once BOOKED_PLUGIN_DIR . 'includes/SettingsPage.php';
require_once BOOKED_PLUGIN_DIR . 'includes/DevelopmentMode.php';
require_once BOOKED_PLUGIN_DIR . 'includes/RestController.php';
require_once BOOKED_PLUGIN_DIR . 'includes/Shortcode.php';
require_once BOOKED_PLUGIN_DIR . 'includes/Block.php';
add_action('plugins_loaded', static function () {
    $api_client = new Booked_ApiClient();
    $variables = new Booked_Variables($api_client);
    $photo_sync = new Booked_PhotoSync($api_client);
    $photo_sync->register();
    (new Booked_SettingsPage())->register();
    (new Booked_DevelopmentMode())->register();
    (new Booked_PageVariables($variables))->register();
    (new Booked_RestController($api_client, $variables, $photo_sync))->register();
    (new Booked_Shortcode())->register();
    (new Booked_Block($variables, $api_client))->register();
});
