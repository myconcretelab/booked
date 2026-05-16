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
        $existing = get_option(BOOKED_OPTION_KEY, []);
        if (!is_array($existing)) {
            $existing = [];
        }

        return [
            'api_base_url' => array_key_exists('api_base_url', $input) ? esc_url_raw((string) $input['api_base_url']) : (string) ($existing['api_base_url'] ?? ''),
            'integration_token' => array_key_exists('integration_token', $input) ? sanitize_text_field((string) $input['integration_token']) : (string) ($existing['integration_token'] ?? ''),
            'webhook_secret' => array_key_exists('webhook_secret', $input) ? sanitize_text_field((string) $input['webhook_secret']) : (string) ($existing['webhook_secret'] ?? ''),
            'timeout_ms' => array_key_exists('timeout_ms', $input) ? max(1000, (int) $input['timeout_ms']) : max(1000, (int) ($existing['timeout_ms'] ?? 10000)),
            'debug_mode' => array_key_exists('debug_mode', $input) ? (!empty($input['debug_mode']) ? 1 : 0) : (!empty($existing['debug_mode']) ? 1 : 0),
            'dynamic_phrases' => array_key_exists('dynamic_phrases', $input) ? $this->sanitize_dynamic_phrases($input['dynamic_phrases']) : $this->sanitize_dynamic_phrases($existing['dynamic_phrases'] ?? []),
        ];
    }

    private function sanitize_dynamic_phrases($input): array
    {
        if (!is_array($input)) {
            return [];
        }

        $phrases = [];
        $seen = [];
        foreach ($input as $item) {
            if (!is_array($item)) {
                continue;
            }

            $title = sanitize_text_field((string) ($item['title'] ?? ''));
            $token = $this->sanitize_phrase_token((string) ($item['token'] ?? ''));
            if ($token === '' && $title !== '') {
                $token = $this->sanitize_phrase_token($title);
            }

            $value = wp_kses_post($this->normalize_variable_tokens((string) ($item['value'] ?? '')));
            if ($token === '' || $value === '' || substr($token, 0, 5) === 'gite.' || isset($seen[$token])) {
                continue;
            }

            $seen[$token] = true;
            $phrases[] = [
                'title' => $title !== '' ? $title : $this->label_from_phrase_token($token),
                'token' => $token,
                'value' => $value,
            ];
        }

        return $phrases;
    }

    private function sanitize_phrase_token(string $token): string
    {
        $token = str_replace(['{{', '}}'], '', $token);
        $token = remove_accents($token);
        $token = strtolower($token);
        $token = preg_replace('/[^a-z0-9_.-]+/', '_', $token);

        return trim((string) $token, '_.-');
    }

    private function label_from_phrase_token(string $token): string
    {
        $label = str_replace(['_', '-', '.'], ' ', $token);
        $label = trim($label);

        return $label === '' ? '' : ucfirst($label);
    }

    private function normalize_variable_tokens(string $value): string
    {
        $aliases = [
            'gite.min_nuits_toute_annee' => 'gite.nb_nuits_minimum_toute_annee',
            'gite.min_nuits_vacances_scolaires' => 'gite.nb_nuits_minimum_vacances_scolaires',
            'gite.min_nuits_juillet_aout' => 'gite.nb_nuits_minimum_juillet_aout',
        ];

        return (string) preg_replace_callback('/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/', static function (array $matches) use ($aliases): string {
            $token = strtolower($matches[1]);

            return isset($aliases[$token]) ? '{{' . $aliases[$token] . '}}' : $matches[0];
        }, $value);
    }

    public function render_page(): void
    {
        $active_tab = isset($_GET['tab']) ? sanitize_key((string) wp_unslash($_GET['tab'])) : 'settings';
        if (!in_array($active_tab, ['settings', 'dynamic_phrases', 'documentation'], true)) {
            $active_tab = 'settings';
        }

        $settings_url = admin_url('options-general.php?page=booked');
        $dynamic_phrases_url = add_query_arg('tab', 'dynamic_phrases', $settings_url);
        $documentation_url = add_query_arg('tab', 'documentation', $settings_url);
        ?>
        <div class="wrap">
            <h1>Booked</h1>

            <nav class="nav-tab-wrapper" aria-label="Onglets Booked">
                <a href="<?php echo esc_url($settings_url); ?>" class="nav-tab <?php echo $active_tab === 'settings' ? 'nav-tab-active' : ''; ?>">Configuration</a>
                <a href="<?php echo esc_url($dynamic_phrases_url); ?>" class="nav-tab <?php echo $active_tab === 'dynamic_phrases' ? 'nav-tab-active' : ''; ?>">Phrases dynamiques</a>
                <a href="<?php echo esc_url($documentation_url); ?>" class="nav-tab <?php echo $active_tab === 'documentation' ? 'nav-tab-active' : ''; ?>">Documentation</a>
            </nav>

            <?php if ($active_tab === 'documentation') : ?>
                <?php $this->render_documentation_tab(); ?>
            <?php elseif ($active_tab === 'dynamic_phrases') : ?>
                <?php $this->render_dynamic_phrases_tab(); ?>
            <?php else : ?>
                <?php $this->render_settings_tab(); ?>
            <?php endif; ?>
        </div>
        <?php
    }

    private function render_settings_tab(): void
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        ?>
            <form method="post" action="options.php">
                <?php settings_fields(BOOKED_OPTION_KEY); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="booked-api-base-url">URL de l'app contrats</label></th>
                        <td><input id="booked-api-base-url" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[api_base_url]" type="url" class="regular-text" value="<?php echo esc_attr($settings['api_base_url'] ?? ''); ?>" placeholder="https://contrats.example.com" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="booked-integration-token">Token d'intégration</label></th>
                        <td>
                            <input id="booked-integration-token" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[integration_token]" type="password" class="regular-text" value="<?php echo esc_attr($settings['integration_token'] ?? ''); ?>" autocomplete="off" />
                            <button type="button" class="button" id="booked-toggle-token">Révéler</button>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="booked-webhook-secret">Secret webhook photos</label></th>
                        <td>
                            <input id="booked-webhook-secret" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[webhook_secret]" type="password" class="regular-text" value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>" autocomplete="off" />
                            <button type="button" class="button" id="booked-toggle-webhook-secret">Révéler</button>
                            <p class="description">À renseigner aussi dans <code>contrats</code> avec <code>BOOKED_WORDPRESS_WEBHOOK_SECRET</code>.</p>
                            <p class="description">URL webhook : <code><?php echo esc_html(rest_url('booked/v1/webhooks/gite-photos')); ?></code></p>
                            <p class="description">À chaque notification de Contrats, Booked importe les photos immédiatement et renvoie le résultat à l'application.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="booked-timeout-ms">Timeout API (ms)</label></th>
                        <td><input id="booked-timeout-ms" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[timeout_ms]" type="number" min="1000" step="500" value="<?php echo esc_attr((string) ($settings['timeout_ms'] ?? 10000)); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row">Debug</th>
                        <td>
                            <label>
                                <input name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[debug_mode]" type="hidden" value="0" />
                                <input name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[debug_mode]" type="checkbox" value="1" <?php checked(!empty($settings['debug_mode'])); ?> />
                                Activer les logs de débogage côté JS
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Connexion API</th>
                        <td>
                            <button type="button" class="button" id="booked-test-api">Tester la connexion</button>
                            <span id="booked-test-api-result" style="display:inline-block;margin-left:10px;"></span>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        <script>
            (function () {
                var button = document.getElementById('booked-test-api');
                var result = document.getElementById('booked-test-api-result');
                var tokenInput = document.getElementById('booked-integration-token');
                var tokenToggle = document.getElementById('booked-toggle-token');
                var webhookSecretInput = document.getElementById('booked-webhook-secret');
                var webhookSecretToggle = document.getElementById('booked-toggle-webhook-secret');

                if (tokenInput && tokenToggle) {
                    tokenToggle.addEventListener('click', function () {
                        var isHidden = tokenInput.type === 'password';
                        tokenInput.type = isHidden ? 'text' : 'password';
                        tokenToggle.textContent = isHidden ? 'Masquer' : 'Révéler';
                    });
                }

                if (webhookSecretInput && webhookSecretToggle) {
                    webhookSecretToggle.addEventListener('click', function () {
                        var isHidden = webhookSecretInput.type === 'password';
                        webhookSecretInput.type = isHidden ? 'text' : 'password';
                        webhookSecretToggle.textContent = isHidden ? 'Masquer' : 'Révéler';
                    });
                }

                if (!button || !result) {
                    return;
                }

                button.addEventListener('click', function () {
                    button.disabled = true;
                    result.textContent = 'Test en cours...';

                    window.fetch('<?php echo esc_url_raw(rest_url('booked/v1/settings/test')); ?>', {
                        headers: {
                            'X-WP-Nonce': '<?php echo esc_js(wp_create_nonce('wp_rest')); ?>'
                        }
                    })
                        .then(function (response) {
                            return response.json().then(function (payload) {
                                if (!response.ok) {
                                    throw new Error(payload.error || 'Connexion impossible.');
                                }
                                return payload;
                            });
                        })
                        .then(function (payload) {
                            result.textContent = payload.message || 'Connexion API valide.';
                            result.style.color = '#166534';
                        })
                        .catch(function (error) {
                            result.textContent = error.message || 'Connexion impossible.';
                            result.style.color = '#991b1b';
                        })
                        .finally(function () {
                            button.disabled = false;
                        });
                });
            })();
        </script>
        <?php
    }

    private function render_dynamic_phrases_tab(): void
    {
        $settings = get_option(BOOKED_OPTION_KEY, []);
        $phrases = is_array($settings['dynamic_phrases'] ?? null) ? $settings['dynamic_phrases'] : [];
        $variable_suggestions = $this->get_variable_suggestions();
        ?>
        <style>
            .booked-phrases { max-width: 1180px; margin-top: 20px; }
            .booked-phrases table { table-layout: fixed; }
            .booked-phrases th:first-child { width: 190px; }
            .booked-phrases th:nth-child(2) { width: 250px; }
            .booked-phrases th:last-child { width: 105px; }
            .booked-phrases input[type="text"],
            .booked-phrases textarea { width: 100%; }
            .booked-phrases textarea { min-height: 76px; }
            .booked-phrases__help { color: #646970; margin: 6px 0 0; }
            .booked-phrases__slug-wrap { align-items: center; display: flex; gap: 6px; }
            .booked-phrases__slug { background: #f6f7f7; cursor: pointer; font-family: Consolas, Monaco, monospace; }
            .booked-phrases__copy-state { color: #166534; display: block; font-size: 12px; min-height: 18px; padding-top: 4px; }
            .booked-phrases__editor { position: relative; }
            .booked-phrases__textarea-wrap { position: relative; }
            .booked-phrases__textarea-highlight,
            .booked-phrases__textarea { box-sizing: border-box; font: inherit; line-height: 1.4; min-height: 76px; padding: 6px 8px; white-space: pre-wrap; word-break: break-word; }
            .booked-phrases__textarea-highlight { border: 1px solid transparent; color: #1d2327; left: 0; overflow: hidden; pointer-events: none; position: absolute; right: 0; top: 0; z-index: 1; }
            .booked-phrases__textarea-token { color: #a7aaad; font-family: Consolas, Monaco, monospace; }
            .booked-phrases__textarea { background: transparent; caret-color: #1d2327; color: transparent; position: relative; resize: vertical; z-index: 2; -webkit-text-fill-color: transparent; }
            .booked-phrases__textarea.booked-phrases__textarea--empty { color: inherit; -webkit-text-fill-color: initial; }
            .booked-phrases__preview { background: #fff; border: 1px solid #dcdcde; margin-top: 8px; min-height: 38px; padding: 8px 10px; }
            .booked-phrases__preview-token { background: #f0f6fc; border-radius: 3px; color: #0969da; font-family: Consolas, Monaco, monospace; padding: 1px 4px; }
            .booked-phrases__menu { background: #fff; border: 1px solid #8c8f94; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14); display: none; left: 0; max-height: 230px; min-width: 310px; overflow: auto; position: absolute; top: 82px; z-index: 20; }
            .booked-phrases__menu button { background: transparent; border: 0; cursor: pointer; display: block; padding: 8px 10px; text-align: left; width: 100%; }
            .booked-phrases__menu button:hover,
            .booked-phrases__menu button:focus { background: #f0f6fc; outline: none; }
            .booked-phrases__menu-token { display: block; font-family: Consolas, Monaco, monospace; }
            .booked-phrases__menu-label { color: #646970; display: block; font-size: 12px; }
            .booked-phrases__preview-controls { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 16px; }
            .booked-phrases__preview-controls select { min-width: 280px; }
            .booked-phrases__preview-status { color: #646970; }
        </style>

        <div class="booked-phrases">
            <form method="post" action="options.php">
                <?php settings_fields(BOOKED_OPTION_KEY); ?>
                <p>Saisissez un libellé lisible, par exemple <code>Phrase prix</code>. Le slug <code>{{phrase_prix}}</code> est généré automatiquement et peut être copié en cliquant dessus.</p>
                <div class="booked-phrases__preview-controls">
                    <label for="booked-preview-gite"><strong>Gîte de prévisualisation</strong></label>
                    <select id="booked-preview-gite">
                        <option value="">Chargement des gîtes...</option>
                    </select>
                    <span class="booked-phrases__preview-status" id="booked-preview-status" aria-live="polite"></span>
                </div>
                <table class="widefat striped" id="booked-dynamic-phrases">
                    <thead>
                        <tr>
                            <th scope="col">Libellé</th>
                            <th scope="col">Slug</th>
                            <th scope="col">Phrase</th>
                            <th scope="col">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($phrases)) : ?>
                            <?php $this->render_dynamic_phrase_row(0, ['title' => '', 'token' => '', 'value' => '']); ?>
                        <?php else : ?>
                            <?php foreach ($phrases as $index => $phrase) : ?>
                                <?php $this->render_dynamic_phrase_row((int) $index, is_array($phrase) ? $phrase : []); ?>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
                <p><button type="button" class="button" id="booked-add-dynamic-phrase">Ajouter une phrase</button></p>
                <?php submit_button('Enregistrer les phrases'); ?>
            </form>
        </div>

        <script>
            (function () {
                var suggestions = <?php echo wp_json_encode($variable_suggestions); ?>;
                var restBase = '<?php echo esc_url_raw(rest_url('booked/v1')); ?>';
                var restNonce = '<?php echo esc_js(wp_create_nonce('wp_rest')); ?>';
                var table = document.getElementById('booked-dynamic-phrases');
                var addButton = document.getElementById('booked-add-dynamic-phrase');
                var previewSelect = document.getElementById('booked-preview-gite');
                var previewStatus = document.getElementById('booked-preview-status');
                if (!table || !addButton || !previewSelect || !previewStatus) return;

                var body = table.querySelector('tbody');
                var nextIndex = body.querySelectorAll('tr').length;
                var previewVariables = {};

                function slugify(value) {
                    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').replace(/^[_.-]+|[_.-]+$/g, '');
                }

                function escapeHtml(value) {
                    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                }

                function formatPreview(value) {
                    return escapeHtml(value || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, function (match, token) {
                        var normalized = token.toLowerCase();
                        if (Object.prototype.hasOwnProperty.call(previewVariables, normalized)) {
                            return escapeHtml(previewVariables[normalized]);
                        }

                        return '<span class="booked-phrases__preview-token">{{' + escapeHtml(token) + '}}</span>';
                    }).replace(/\n/g, '<br>');
                }

                function normalizeVariableTokens(value) {
                    var aliases = {
                        'gite.min_nuits_toute_annee': 'gite.nb_nuits_minimum_toute_annee',
                        'gite.min_nuits_vacances_scolaires': 'gite.nb_nuits_minimum_vacances_scolaires',
                        'gite.min_nuits_juillet_aout': 'gite.nb_nuits_minimum_juillet_aout'
                    };

                    return String(value || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, function (match, token) {
                        var normalized = token.toLowerCase();
                        return Object.prototype.hasOwnProperty.call(aliases, normalized) ? '{{' + aliases[normalized] + '}}' : match;
                    });
                }

                function formatTextareaHighlight(value) {
                    var html = escapeHtml(value || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, function (match, token) {
                        return '<span class="booked-phrases__textarea-token">{{' + escapeHtml(token) + '}}</span>';
                    });

                    return (html || ' ') + '\n';
                }

                function getCurrentTokenStart(textarea) {
                    var beforeCursor = textarea.value.slice(0, textarea.selectionStart || 0);
                    var start = beforeCursor.lastIndexOf('{{');
                    if (start === -1) return -1;

                    var partial = beforeCursor.slice(start + 2);
                    if (partial.indexOf('}}') !== -1 || /\s/.test(partial)) return -1;

                    return start;
                }

                function buildMenu(row, textarea) {
                    var menu = row.querySelector('.booked-phrases__menu');
                    var start = getCurrentTokenStart(textarea);
                    if (start === -1) {
                        menu.style.display = 'none';
                        return;
                    }

                    var search = textarea.value.slice(start + 2, textarea.selectionStart || 0).toLowerCase();
                    var matches = suggestions.filter(function (item) {
                        return item.token.indexOf(search) !== -1 || item.label.toLowerCase().indexOf(search) !== -1;
                    }).slice(0, 18);

                    if (!matches.length) {
                        menu.style.display = 'none';
                        return;
                    }

                    menu.innerHTML = matches.map(function (item) {
                        return '<button type="button" data-token="' + escapeHtml(item.token) + '"><span class="booked-phrases__menu-token">{{' + escapeHtml(item.token) + '}}</span><span class="booked-phrases__menu-label">' + escapeHtml(item.label) + '</span></button>';
                    }).join('');
                    menu.style.display = 'block';
                }

                function insertVariable(textarea, token) {
                    var start = getCurrentTokenStart(textarea);
                    if (start === -1) return;

                    var end = textarea.selectionStart || 0;
                    var replacement = '{{' + token + '}}';
                    textarea.value = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
                    textarea.focus();
                    textarea.selectionStart = textarea.selectionEnd = start + replacement.length;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }

                function copyText(value, state) {
                    function done() {
                        state.textContent = 'Copié';
                        window.setTimeout(function () { state.textContent = ''; }, 1400);
                    }

                    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
                        window.navigator.clipboard.writeText(value).then(done);
                        return;
                    }

                    var temp = document.createElement('textarea');
                    temp.value = value;
                    document.body.appendChild(temp);
                    temp.select();
                    document.execCommand('copy');
                    temp.remove();
                    done();
                }

                function normalizeKey(key) {
                    return String(key || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
                }

                function formatValue(value) {
                    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                    if (value === null || typeof value === 'undefined') return '';
                    return String(value);
                }

                function isScalar(value) {
                    return value === null || ['string', 'number', 'boolean'].indexOf(typeof value) !== -1;
                }

                function isListOfScalars(value) {
                    return Array.isArray(value) && value.length > 0 && value.every(isScalar);
                }

                function shouldSkipPath(path) {
                    var root = String(path || '').split('.')[0];
                    return ['sections', 'groupes', 'variables'].indexOf(root) !== -1;
                }

                function flattenScalars(value, prefix, output) {
                    if (!value || typeof value !== 'object') return;

                    Object.keys(value).forEach(function (rawKey) {
                        var key = normalizeKey(rawKey);
                        if (!key) return;

                        var path = prefix ? prefix + '.' + key : key;
                        if (shouldSkipPath(path)) return;

                        var item = value[rawKey];
                        if (Array.isArray(item)) {
                            if (isListOfScalars(item)) {
                                output[path] = item.map(formatValue).join(', ');
                            }
                            return;
                        }

                        if (item && typeof item === 'object') {
                            flattenScalars(item, path, output);
                            return;
                        }

                        if (isScalar(item)) {
                            output[path] = item;
                        }
                    });
                }

                function findPrefix(content) {
                    var keys = ['prefixe_contrat', 'prefixe', 'prefix', 'variable_prefix', 'variables_prefix'];
                    for (var i = 0; i < keys.length; i++) {
                        if (content && isScalar(content[keys[i]]) && String(content[keys[i]]) !== '') {
                            return normalizeKey(content[keys[i]]);
                        }
                    }

                    return '';
                }

                function semanticAliases(path) {
                    var aliases = {
                        public_summary: ['accroche_courte'],
                        public_description: ['description_longue'],
                        public_technical_description: ['description_technique'],
                        accroche_courte: ['public_summary'],
                        description_longue: ['public_description'],
                        description_technique: ['public_technical_description'],
                        min_nuits_toute_annee: ['nb_nuits_minimum_toute_annee'],
                        min_nuits_vacances_scolaires: ['nb_nuits_minimum_vacances_scolaires'],
                        min_nuits_juillet_aout: ['nb_nuits_minimum_juillet_aout'],
                        nb_nuits_minimum_toute_annee: ['min_nuits_toute_annee'],
                        nb_nuits_minimum_vacances_scolaires: ['min_nuits_vacances_scolaires'],
                        nb_nuits_minimum_juillet_aout: ['min_nuits_juillet_aout']
                    };

                    return aliases[path] || [];
                }

                function addTokenAliases(map, path, value, prefix) {
                    map[path] = value;
                    map['gite.' + path] = value;
                    if (prefix) {
                        map[prefix + '.' + path] = value;
                    }

                    semanticAliases(path).forEach(function (alias) {
                        map[alias] = value;
                        map['gite.' + alias] = value;
                        if (prefix) {
                            map[prefix + '.' + alias] = value;
                        }
                    });
                }

                function contentToVariableMap(content) {
                    var flat = {};
                    var map = {};
                    var prefix = findPrefix(content);

                    flattenScalars(content, '', flat);
                    Object.keys(flat).forEach(function (path) {
                        addTokenAliases(map, path.toLowerCase(), formatValue(flat[path]), prefix);
                    });

                    if (content && content.variables && typeof content.variables === 'object') {
                        var variableFlat = {};
                        flattenScalars(content.variables, '', variableFlat);
                        Object.keys(variableFlat).forEach(function (path) {
                            addTokenAliases(map, path.toLowerCase(), formatValue(variableFlat[path]), prefix);
                        });
                    }

                    return map;
                }

                function bindRow(row) {
                    var titleInput = row.querySelector('.booked-phrases__title');
                    var tokenInput = row.querySelector('.booked-phrases__slug');
                    var textarea = row.querySelector('textarea');
                    var highlight = row.querySelector('.booked-phrases__textarea-highlight');
                    var preview = row.querySelector('.booked-phrases__preview');
                    var menu = row.querySelector('.booked-phrases__menu');
                    var state = row.querySelector('.booked-phrases__copy-state');
                    var removeButton = row.querySelector('.booked-remove-dynamic-phrase');

                    function syncSlug() {
                        tokenInput.value = '{{' + slugify(titleInput.value) + '}}';
                    }

                    function syncPreview() {
                        preview.innerHTML = formatPreview(textarea.value) || '<span class="booked-phrases__help">La phrase propre s’affichera ici.</span>';
                    }

                    function normalizeTextarea() {
                        var normalizedValue = normalizeVariableTokens(textarea.value);
                        if (normalizedValue !== textarea.value) {
                            textarea.value = normalizedValue;
                        }
                    }

                    function syncHighlight() {
                        highlight.innerHTML = formatTextareaHighlight(textarea.value);
                        highlight.scrollTop = textarea.scrollTop;
                        textarea.classList.toggle('booked-phrases__textarea--empty', textarea.value === '');
                    }

                    titleInput.addEventListener('input', syncSlug);
                    tokenInput.addEventListener('click', function () {
                        if (tokenInput.value !== '{{}}') copyText(tokenInput.value, state);
                    });
                    textarea.addEventListener('input', function () {
                        normalizeTextarea();
                        syncHighlight();
                        syncPreview();
                        buildMenu(row, textarea);
                    });
                    textarea.addEventListener('scroll', function () {
                        highlight.scrollTop = textarea.scrollTop;
                    });
                    textarea.addEventListener('keyup', function () { buildMenu(row, textarea); });
                    textarea.addEventListener('click', function () { buildMenu(row, textarea); });
                    textarea.addEventListener('blur', function () {
                        window.setTimeout(function () { menu.style.display = 'none'; }, 150);
                    });
                    menu.addEventListener('mousedown', function (event) {
                        var button = event.target.closest('button[data-token]');
                        if (!button) return;

                        event.preventDefault();
                        insertVariable(textarea, button.getAttribute('data-token'));
                        menu.style.display = 'none';
                    });
                    removeButton.addEventListener('click', function () {
                        var rows = body.querySelectorAll('tr');
                        if (rows.length === 1) {
                            titleInput.value = '';
                            textarea.value = '';
                            syncSlug();
                            syncHighlight();
                            syncPreview();
                            return;
                        }

                        row.remove();
                    });

                    syncSlug();
                    normalizeTextarea();
                    syncHighlight();
                    syncPreview();
                }

                function refreshAllPreviews() {
                    body.querySelectorAll('tr').forEach(function (row) {
                        var textarea = row.querySelector('textarea');
                        var preview = row.querySelector('.booked-phrases__preview');
                        if (textarea && preview) {
                            preview.innerHTML = formatPreview(textarea.value) || '<span class="booked-phrases__help">La phrase propre s’affichera ici.</span>';
                        }
                    });
                }

                function apiFetch(path) {
                    return window.fetch(restBase + path, {
                        headers: {
                            'X-WP-Nonce': restNonce
                        }
                    }).then(function (response) {
                        return response.json().then(function (payload) {
                            if (!response.ok) {
                                throw new Error(payload.error || 'Chargement impossible.');
                            }
                            return payload;
                        });
                    });
                }

                function loadPreviewVariables(giteId) {
                    previewVariables = {};
                    refreshAllPreviews();

                    if (!giteId) {
                        previewStatus.textContent = 'Choisissez un gîte pour voir les vraies valeurs.';
                        return;
                    }

                    previewStatus.textContent = 'Chargement des valeurs...';
                    apiFetch('/gites/' + encodeURIComponent(giteId) + '/content')
                        .then(function (payload) {
                            var content = payload && typeof payload === 'object' ? (payload.data || payload.content || payload) : {};
                            previewVariables = contentToVariableMap(content);
                            previewStatus.textContent = Object.keys(previewVariables).length ? 'Aperçu avec les valeurs du gîte sélectionné.' : 'Aucune variable trouvée pour ce gîte.';
                            refreshAllPreviews();
                        })
                        .catch(function (error) {
                            previewVariables = {};
                            previewStatus.textContent = error.message || 'Chargement impossible.';
                            refreshAllPreviews();
                        });
                }

                function loadPreviewGites() {
                    apiFetch('/gites')
                        .then(function (payload) {
                            var gites = payload.gites || [];
                            if (!gites.length) {
                                previewSelect.innerHTML = '<option value="">Aucun gîte disponible</option>';
                                previewStatus.textContent = 'Aucun gîte disponible pour la prévisualisation.';
                                return;
                            }

                            previewSelect.innerHTML = gites.map(function (gite) {
                                var label = gite.capacity ? gite.name + ' (' + gite.capacity + ' pers.)' : gite.name;
                                return '<option value="' + escapeHtml(gite.id) + '">' + escapeHtml(label) + '</option>';
                            }).join('');
                            loadPreviewVariables(previewSelect.value);
                        })
                        .catch(function (error) {
                            previewSelect.innerHTML = '<option value="">Chargement impossible</option>';
                            previewStatus.textContent = error.message || 'Chargement impossible.';
                        });
                }

                function rowHtml(index) {
                    return '<td><input class="booked-phrases__title" type="text" name="<?php echo esc_js(BOOKED_OPTION_KEY); ?>[dynamic_phrases][' + index + '][title]" placeholder="Phrase prix" /></td>'
                        + '<td><div class="booked-phrases__slug-wrap"><input class="booked-phrases__slug" type="text" name="<?php echo esc_js(BOOKED_OPTION_KEY); ?>[dynamic_phrases][' + index + '][token]" value="{{}}" readonly aria-label="Slug copiable" /></div><span class="booked-phrases__copy-state" aria-live="polite"></span></td>'
                        + '<td><div class="booked-phrases__editor"><div class="booked-phrases__textarea-wrap"><div class="booked-phrases__textarea-highlight" aria-hidden="true"></div><textarea class="booked-phrases__textarea booked-phrases__textarea--empty" name="<?php echo esc_js(BOOKED_OPTION_KEY); ?>[dynamic_phrases][' + index + '][value]" rows="3" placeholder="Les prix sont de {{gite.prix_nuit_basse_saison}} pour un nombre de nuits de {{gite.nb_nuits_minimum_toute_annee}}."></textarea></div><div class="booked-phrases__menu"></div></div><p class="booked-phrases__help">Tapez {{ pour insérer une variable existante.</p><div class="booked-phrases__preview" aria-live="polite"></div></td>'
                        + '<td><button type="button" class="button booked-remove-dynamic-phrase">Supprimer</button></td>';
                }

                body.querySelectorAll('tr').forEach(bindRow);
                addButton.addEventListener('click', function () {
                    var row = document.createElement('tr');
                    row.innerHTML = rowHtml(nextIndex);
                    body.appendChild(row);
                    bindRow(row);
                    nextIndex++;
                });
                previewSelect.addEventListener('change', function () {
                    loadPreviewVariables(previewSelect.value);
                });
                loadPreviewGites();
            })();
        </script>
        <?php
    }

    private function render_dynamic_phrase_row(int $index, array $phrase): void
    {
        $token = $this->sanitize_phrase_token((string) ($phrase['token'] ?? ''));
        $title = (string) ($phrase['title'] ?? $this->label_from_phrase_token($token));
        $value = $this->normalize_variable_tokens((string) ($phrase['value'] ?? ''));
        ?>
        <tr>
            <td>
                <input class="booked-phrases__title" type="text" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[dynamic_phrases][<?php echo esc_attr((string) $index); ?>][title]" value="<?php echo esc_attr($title); ?>" placeholder="Phrase prix" />
            </td>
            <td>
                <div class="booked-phrases__slug-wrap">
                    <input class="booked-phrases__slug" type="text" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[dynamic_phrases][<?php echo esc_attr((string) $index); ?>][token]" value="<?php echo esc_attr('{{' . $token . '}}'); ?>" readonly aria-label="Slug copiable" />
                </div>
                <span class="booked-phrases__copy-state" aria-live="polite"></span>
            </td>
            <td>
                <div class="booked-phrases__editor">
                    <div class="booked-phrases__textarea-wrap">
                        <div class="booked-phrases__textarea-highlight" aria-hidden="true"></div>
                        <textarea class="booked-phrases__textarea <?php echo $value === '' ? 'booked-phrases__textarea--empty' : ''; ?>" name="<?php echo esc_attr(BOOKED_OPTION_KEY); ?>[dynamic_phrases][<?php echo esc_attr((string) $index); ?>][value]" rows="3" placeholder="Les prix sont de {{gite.prix_nuit_basse_saison}} pour un nombre de nuits de {{gite.nb_nuits_minimum_toute_annee}}."><?php echo esc_textarea($value); ?></textarea>
                    </div>
                    <div class="booked-phrases__menu"></div>
                </div>
                <p class="booked-phrases__help">Tapez {{ pour insérer une variable existante.</p>
                <div class="booked-phrases__preview" aria-live="polite"></div>
            </td>
            <td>
                <button type="button" class="button booked-remove-dynamic-phrase">Supprimer</button>
            </td>
        </tr>
        <?php
    }

    private function get_variable_suggestions(): array
    {
        $variables = [
            'gite.nom' => 'Nom du gîte',
            'gite.accroche_courte' => 'Accroche courte',
            'gite.description_longue' => 'Description longue',
            'gite.description_technique' => 'Description technique',
            'gite.adresse_complete' => 'Adresse complète',
            'gite.horaire_arrivee' => 'Horaire d’arrivée',
            'gite.horaire_depart' => 'Horaire de départ',
            'gite.prix_nuit_basse_saison' => 'Prix/nuit basse saison',
            'gite.prix_nuit_haute_saison' => 'Prix/nuit haute saison',
            'gite.nb_nuits_minimum_toute_annee' => 'Minimum de nuits toute l’année',
            'gite.nb_nuits_minimum_vacances_scolaires' => 'Minimum de nuits vacances scolaires',
            'gite.nb_nuits_minimum_juillet_aout' => 'Minimum de nuits juillet-août',
            'gite.service_menage_forfait' => 'Ménage forfait',
            'gite.service_draps_par_lit' => 'Draps / lit',
            'gite.service_linge_toilette_par_personne' => 'Linge toilette / personne',
            'gite.service_chiens_par_nuit' => 'Chiens / nuit',
            'gite.service_depart_tardif_forfait' => 'Départ tardif forfait',
        ];

        $suggestions = [];
        foreach ($variables as $token => $label) {
            $suggestions[] = [
                'token' => $token,
                'label' => $label,
            ];
        }

        return $suggestions;
    }

    private function render_documentation_tab(): void
    {
        ?>
        <style>
            .booked-docs {
                max-width: 960px;
                margin-top: 24px;
            }

            .booked-docs__section {
                background: #fff;
                border: 1px solid #dcdcde;
                margin: 0 0 16px;
                padding: 18px 20px;
            }

            .booked-docs__section h2 {
                margin-top: 0;
            }

            .booked-docs__section h3 {
                margin-bottom: 6px;
            }

            .booked-docs code {
                background: #f6f7f7;
                padding: 2px 5px;
            }

            .booked-docs pre {
                background: #f6f7f7;
                border: 1px solid #dcdcde;
                overflow: auto;
                padding: 12px;
                white-space: pre-wrap;
            }

            .booked-docs table {
                border-collapse: collapse;
                width: 100%;
            }

            .booked-docs th,
            .booked-docs td {
                border-bottom: 1px solid #dcdcde;
                padding: 8px 10px;
                text-align: left;
                vertical-align: top;
            }

            .booked-docs th {
                width: 210px;
            }
        </style>

        <div class="booked-docs">
            <section class="booked-docs__section">
                <h2>Vue d’ensemble</h2>
                <p>Booked ajoute des blocs Gutenberg et un shortcode pour afficher les disponibilités, les demandes de réservation et les informations publiques d’un gîte depuis l’application contrats.</p>
                <p>Avant utilisation, renseignez l’URL de l’application contrats et le token d’intégration dans l’onglet Configuration, puis utilisez le bouton de test pour vérifier la connexion API.</p>
            </section>

            <section class="booked-docs__section">
                <h2>Configuration</h2>
                <table>
                    <tbody>
                        <tr>
                            <th scope="row">URL de l’app contrats</th>
                            <td>Adresse racine de l’application contrats, par exemple <code>https://contrats.example.com</code>. Le plugin ajoute ensuite automatiquement les chemins API nécessaires.</td>
                        </tr>
                        <tr>
                            <th scope="row">Token d’intégration</th>
                            <td>Token Bearer envoyé à l’application contrats pour récupérer les gîtes, contenus, disponibilités et devis.</td>
                        </tr>
                        <tr>
                            <th scope="row">Timeout API</th>
                            <td>Délai maximal des appels serveur vers l’application contrats, en millisecondes. La valeur minimale est <code>1000</code>.</td>
                        </tr>
                        <tr>
                            <th scope="row">Debug</th>
                            <td>Active les logs JavaScript côté navigateur pour faciliter le diagnostic du widget public.</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section class="booked-docs__section">
                <h2>Blocs Gutenberg</h2>

                <h3>Booked</h3>
                <p>Affiche le calendrier de disponibilités du gîte.</p>
                <ul>
                    <li><strong>Gîte</strong> : sélection depuis la liste API ou saisie manuelle de l’identifiant.</li>
                    <li><strong>Mois affichés</strong> : de 1 à 12 mois.</li>
                    <li><strong>Options</strong> : affichage du titre, de la capacité et des codes couleurs des périodes liées aux nombres de nuits.</li>
                </ul>

                <h3>Booked Infos gîte</h3>
                <p>Affiche les équipements, chambres et informations publiques du gîte.</p>
                <ul>
                    <li><strong>Présentations</strong> : liste, accordéons ou cards.</li>
                    <li><strong>Filtrage</strong> : sections et groupes sélectionnables dans l’éditeur.</li>
                    <li><strong>Options</strong> : titre, titres de sections et notes.</li>
                </ul>

                <h3>Booked Accordéon</h3>
                <p>Ajoute un accordéon animé réutilisable dans les contenus. Il accepte un titre, un état ouvert par défaut, une icône texte optionnelle et des blocs internes.</p>

                <h3>Booked Texte</h3>
                <p>Permet de rédiger un texte enrichi avec des variables de gîte. Les variables sont remplacées au rendu public.</p>
                <pre><code>Bienvenue au {{gite.nom}}.
Adresse : {{gite.adresse_complete}}
Arrivée : {{gite.horaire_arrivee}}</code></pre>
            </section>

            <section class="booked-docs__section">
                <h2>Shortcode</h2>
                <p>Le shortcode principal est <code>[booked_widget]</code>. L’attribut <code>gite_id</code> est obligatoire.</p>
                <pre><code>[booked_widget gite_id="mon-gite"]</code></pre>
                <pre><code>[booked_widget gite_id="mon-gite" months="3" show_title="0" show_capacity="1"]</code></pre>

                <table>
                    <thead>
                        <tr>
                            <th scope="col">Attribut</th>
                            <th scope="col">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th scope="row"><code>gite_id</code></th>
                            <td>Identifiant du gîte côté application contrats. Obligatoire.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>months</code></th>
                            <td>Nombre de mois affichés, entre <code>1</code> et <code>12</code>. Valeur par défaut : <code>2</code>.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>show_title</code></th>
                            <td><code>1</code> pour afficher le titre, <code>0</code> pour le masquer. Valeur par défaut : <code>1</code>.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>show_capacity</code></th>
                            <td><code>1</code> pour afficher la capacité, <code>0</code> pour la masquer. Valeur par défaut : <code>1</code>.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>show_period_colors</code></th>
                            <td><code>1</code> pour afficher les codes couleurs des périodes liées aux nombres de nuits, <code>0</code> pour les masquer. Valeur par défaut : <code>1</code>.</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section class="booked-docs__section">
                <h2>Variables de contenu</h2>
                <p>Les variables s’écrivent entre doubles accolades. Le format recommandé est <code>{{gite.nom_de_la_variable}}</code>. Elles sont disponibles dans le bloc <strong>Booked Texte</strong> et dans les blocs Gutenberg natifs si un gîte par défaut est défini pour la page.</p>
                <p>Dans un modèle, le bloc <strong>Booked Texte</strong> peut insérer les variables communes sans gîte sélectionné. Au rendu public, les valeurs sont remplacées avec le gîte du bloc, le gîte par défaut de la page, ou le premier bloc Booked de la page qui possède un gîte.</p>

                <h3>Gîte par défaut d’une page</h3>
                <p>Dans l’éditeur Gutenberg, ouvrez les réglages de la page ou de l’article, puis le panneau <strong>Booked</strong>. Sélectionnez un gîte. Les blocs natifs de cette page pourront alors utiliser les variables <code>{{gite...}}</code>.</p>

                <h3>Phrases dynamiques</h3>
                <p>L’onglet <strong>Phrases dynamiques</strong> permet de créer des variables personnalisées. Saisissez un libellé, par exemple <code>Phrase prix</code>, puis la phrase complète. Le slug <code>{{phrase_prix}}</code> est généré automatiquement et copiable. Le sélecteur de gîte affiche l’aperçu avec les vraies valeurs du gîte choisi.</p>
                <pre><code>Libellé : Phrase prix
Phrase : Les prix sont de {{gite.prix_nuit_basse_saison}} pour un nombre de nuits de {{gite.nb_nuits_minimum_toute_annee}}.

Utilisation dans le contenu : {{phrase_prix}}</code></pre>

                <h3>Exemples de variables courantes</h3>
                <table>
                    <tbody>
                        <tr>
                            <th scope="row"><code>{{gite.adresse_complete}}</code></th>
                            <td>Adresse complète du gîte.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.accroche_courte}}</code></th>
                            <td>Accroche courte publique du gîte.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.description_longue}}</code></th>
                            <td>Description longue publique du gîte.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.horaire_arrivee}}</code></th>
                            <td>Horaire d’arrivée.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.horaire_depart}}</code></th>
                            <td>Horaire de départ.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.description_technique}}</code></th>
                            <td>Description technique publique du gîte.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.prix_nuit_basse_saison}}</code></th>
                            <td>Prix par nuit en basse saison.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.prix_nuit_haute_saison}}</code></th>
                            <td>Prix par nuit en haute saison.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.nb_nuits_minimum_toute_annee}}</code></th>
                            <td>Nombre minimum de nuits toute l’année.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.nb_nuits_minimum_vacances_scolaires}}</code></th>
                            <td>Nombre minimum de nuits pendant les vacances scolaires.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.nb_nuits_minimum_juillet_aout}}</code></th>
                            <td>Nombre minimum de nuits en juillet-août.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.service_menage_forfait}}</code></th>
                            <td>Forfait ménage.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.service_draps_par_lit}}</code></th>
                            <td>Prix des draps par lit.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.service_linge_toilette_par_personne}}</code></th>
                            <td>Prix du linge de toilette par personne.</td>
                        </tr>
                    </tbody>
                </table>
                <p>La liste exacte dépend des données renvoyées par l’application contrats. Dans le bloc <strong>Booked Texte</strong>, le panneau Variables affiche les variables disponibles pour le gîte sélectionné.</p>
            </section>

            <section class="booked-docs__section">
                <h2>API utilisée par le plugin</h2>
                <p>Le plugin expose des routes WordPress sous <code>/wp-json/booked/v1</code>, qui relaient les appels vers l’application contrats.</p>
                <table>
                    <tbody>
                        <tr>
                            <th scope="row"><code>GET /gites</code></th>
                            <td>Liste des gîtes pour l’éditeur.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>GET /gites/{id}/config</code></th>
                            <td>Configuration publique du widget de réservation.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>GET /gites/{id}/content</code></th>
                            <td>Contenu public, sections, groupes et variables du gîte.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>GET /gites/{id}/availability</code></th>
                            <td>Disponibilités, avec paramètres optionnels <code>from</code> et <code>to</code>.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>POST /gites/{id}/quote</code></th>
                            <td>Calcul de devis.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>POST /requests</code></th>
                            <td>Création d’une demande de réservation.</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section class="booked-docs__section">
                <h2>Dépannage</h2>
                <ul>
                    <li>Si aucun gîte ne s’affiche dans l’éditeur, vérifiez l’URL, le token et le bouton “Tester la connexion”.</li>
                    <li>Si le widget public reste vide, activez temporairement le mode Debug et consultez la console du navigateur.</li>
                    <li>Si une variable reste affichée telle quelle, vérifiez qu’un gîte est sélectionné et que la variable existe bien dans les données du gîte.</li>
                    <li>Les contenus de variables sont mis en cache pendant 15 minutes côté WordPress.</li>
                </ul>
            </section>
        </div>
        <?php
    }
}
