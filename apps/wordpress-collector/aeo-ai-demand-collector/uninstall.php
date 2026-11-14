<?php
/**
 * Runs when the plugin is deleted from the Plugins screen: removes everything it stored.
 *
 * @package AeoAiDemandCollector
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'aeo_collector_key' );
delete_option( 'aeo_collector_ip_source' );
delete_option( 'aeo_collector_queue' );
wp_clear_scheduled_hook( 'aeo_collector_flush' );
