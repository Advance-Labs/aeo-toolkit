<?php
/**
 * Plugin Name:       AEO AI Demand Collector
 * Description:       Counts the requests AI assistants (ChatGPT-User, Claude-User, Perplexity-User and other AI bots) make to your pages and sends the daily counts to your AEO Toolkit dashboard. Human visits never leave your site.
 * Version:           0.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Advance Labs
 * Author URI:        https://advancelabs.dev
 * License:           Apache-2.0
 * License URI:       https://www.apache.org/licenses/LICENSE-2.0
 * Text Domain:       aeo-ai-demand-collector
 *
 * @package AeoAiDemandCollector
 */

defined( 'ABSPATH' ) || exit;

// Keep identical to AI_BOT_PATTERN in the console's apps/console/src/lib/ai-bots/classify.ts
// (docs/AI-BOT-COLLECTOR.md there). A test in this repo checks it still matches the bots listed here.
const AEO_COLLECTOR_AI_BOTS = '/(?:^|[^A-Za-z0-9-])(ChatGPT-User|OAI-SearchBot|GPTBot|Claude-User|Claude-SearchBot|ClaudeBot|Perplexity-User|PerplexityBot|MistralAI-User|DuckAssistBot|Meta-ExternalFetcher|Meta-ExternalAgent|Amazonbot|Bytespider|CCBot)(?![A-Za-z0-9-])/i';
const AEO_COLLECTOR_ENDPOINT = 'https://aeo.advancelabs.dev/api/collect/ai-bots';
const AEO_COLLECTOR_QUEUE    = 'aeo_collector_queue';
const AEO_COLLECTOR_FLUSH    = 'aeo_collector_flush';
const AEO_COLLECTOR_BATCH    = 20;

/** Options: aeo_collector_key (string), aeo_collector_ip_source ('remote_addr' | 'cf' | 'xff'). */
function aeo_collector_ip() {
	$source = get_option( 'aeo_collector_ip_source', 'remote_addr' );
	$header = array(
		'cf'  => 'HTTP_CF_CONNECTING_IP',
		'xff' => 'HTTP_X_FORWARDED_FOR',
	);
	$raw = isset( $header[ $source ], $_SERVER[ $header[ $source ] ] ) ? $_SERVER[ $header[ $source ] ] : ( $_SERVER['REMOTE_ADDR'] ?? '' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$ip  = trim( explode( ',', sanitize_text_field( wp_unslash( $raw ) ) )[0] );
	return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '';
}

/**
 * Server-side filter: only a request whose User-Agent names an AI bot is ever queued.
 * Human visits, admin and non-GET requests return before anything is read or stored.
 */
function aeo_collector_capture() {
	if ( is_admin() || is_user_logged_in() || ! in_array( $_SERVER['REQUEST_METHOD'] ?? '', array( 'GET', 'HEAD' ), true ) ) {
		return;
	}
	if ( '' === (string) get_option( 'aeo_collector_key', '' ) ) {
		return;
	}
	$ua = substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ?? '' ) ), 0, 512 ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	if ( '' === $ua || ! preg_match( AEO_COLLECTOR_AI_BOTS, $ua ) ) {
		return;
	}
	$uri  = sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ?? '/' ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
	$path = (string) strtok( $uri, '?#' ); // No query string or fragment: they can carry personal data.

	$queue   = get_option( AEO_COLLECTOR_QUEUE, array() );
	$queue   = is_array( $queue ) ? $queue : array();
	$queue[] = array(
		'ua'   => $ua,
		'path' => substr( $path, 0, 512 ),
		'ts'   => (int) round( microtime( true ) * 1000 ),
		'ip'   => apply_filters( 'aeo_collector_client_ip', aeo_collector_ip() ), // Sent for range verification, never stored by AEO.
	);
	update_option( AEO_COLLECTOR_QUEUE, $queue, false );

	if ( count( $queue ) >= AEO_COLLECTOR_BATCH ) {
		add_action( 'shutdown', 'aeo_collector_flush' ); // After the response, so the visitor never waits.
	} elseif ( ! wp_next_scheduled( AEO_COLLECTOR_FLUSH ) ) {
		wp_schedule_single_event( time() + 120, AEO_COLLECTOR_FLUSH );
	}
}
add_action( 'template_redirect', 'aeo_collector_capture', 1 );

/** One batched, non-blocking POST. A failed send drops the batch: counts are approximate by design. */
function aeo_collector_flush() {
	$key   = (string) get_option( 'aeo_collector_key', '' );
	$queue = get_option( AEO_COLLECTOR_QUEUE, array() );
	if ( '' === $key || ! is_array( $queue ) || array() === $queue ) {
		return;
	}
	delete_option( AEO_COLLECTOR_QUEUE );
	wp_remote_post(
		AEO_COLLECTOR_ENDPOINT,
		array(
			'blocking' => false,
			'timeout'  => 5,
			'headers'  => array(
				'Authorization' => 'Bearer ' . $key,
				'Content-Type'  => 'application/json',
			),
			'body'     => wp_json_encode( array( 'events' => array_slice( $queue, 0, 1000 ) ) ),
		)
	);
}
add_action( AEO_COLLECTOR_FLUSH, 'aeo_collector_flush' );

// ---- Settings page (Settings > AI demand collector), administrators only. ----

function aeo_collector_register_settings() {
	register_setting(
		'aeo_collector',
		'aeo_collector_key',
		array(
			'type'              => 'string',
			'default'           => '',
			'sanitize_callback' => static function ( $value ) {
				$value = trim( sanitize_text_field( (string) $value ) );
				if ( '' !== $value && ! preg_match( '/^aeoc_[A-Za-z0-9_-]{20,200}$/', $value ) ) {
					add_settings_error( 'aeo_collector_key', 'aeo_bad_key', __( 'That does not look like a collector key. It starts with aeoc_.', 'aeo-ai-demand-collector' ) );
					return (string) get_option( 'aeo_collector_key', '' );
				}
				return $value;
			},
		)
	);
	register_setting(
		'aeo_collector',
		'aeo_collector_ip_source',
		array(
			'type'              => 'string',
			'default'           => 'remote_addr',
			'sanitize_callback' => static function ( $value ) {
				return in_array( $value, array( 'remote_addr', 'cf', 'xff' ), true ) ? $value : 'remote_addr';
			},
		)
	);
}
add_action( 'admin_init', 'aeo_collector_register_settings' );

function aeo_collector_menu() {
	add_options_page( __( 'AI demand collector', 'aeo-ai-demand-collector' ), __( 'AI demand collector', 'aeo-ai-demand-collector' ), 'manage_options', 'aeo-ai-demand-collector', 'aeo_collector_page' );
}
add_action( 'admin_menu', 'aeo_collector_menu' );

function aeo_collector_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to view this page.', 'aeo-ai-demand-collector' ) );
	}
	$source = get_option( 'aeo_collector_ip_source', 'remote_addr' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'AI demand collector', 'aeo-ai-demand-collector' ); ?></h1>
		<p><?php esc_html_e( 'Counts how often AI assistants such as ChatGPT, Claude and Perplexity read your pages. Only requests from AI bots are sent, as page paths and the bot name. Visitors, query strings and cookies never leave your site.', 'aeo-ai-demand-collector' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'aeo_collector' ); // Prints the nonce; options.php checks it and manage_options. ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="aeo_collector_key"><?php esc_html_e( 'Collector key', 'aeo-ai-demand-collector' ); ?></label></th>
					<td>
						<input type="password" id="aeo_collector_key" name="aeo_collector_key" class="regular-text" autocomplete="off" value="<?php echo esc_attr( (string) get_option( 'aeo_collector_key', '' ) ); ?>" />
						<p class="description"><?php esc_html_e( 'Create it on the AI demand page of your AEO Toolkit dashboard. Leave empty to turn collection off.', 'aeo-ai-demand-collector' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="aeo_collector_ip_source"><?php esc_html_e( 'Where is the visitor IP?', 'aeo-ai-demand-collector' ); ?></label></th>
					<td>
						<select id="aeo_collector_ip_source" name="aeo_collector_ip_source">
							<option value="remote_addr" <?php selected( $source, 'remote_addr' ); ?>><?php esc_html_e( 'Directly connected (default)', 'aeo-ai-demand-collector' ); ?></option>
							<option value="cf" <?php selected( $source, 'cf' ); ?>><?php esc_html_e( 'Behind Cloudflare', 'aeo-ai-demand-collector' ); ?></option>
							<option value="xff" <?php selected( $source, 'xff' ); ?>><?php esc_html_e( 'Behind another proxy (X-Forwarded-For)', 'aeo-ai-demand-collector' ); ?></option>
						</select>
						<p class="description"><?php esc_html_e( 'Used only to check the request really came from the AI vendor. Never stored.', 'aeo-ai-demand-collector' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}
