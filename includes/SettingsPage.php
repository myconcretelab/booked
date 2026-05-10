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
        $active_tab = isset($_GET['tab']) ? sanitize_key((string) wp_unslash($_GET['tab'])) : 'settings';
        if (!in_array($active_tab, ['settings', 'documentation'], true)) {
            $active_tab = 'settings';
        }

        $settings_url = admin_url('options-general.php?page=booked');
        $documentation_url = add_query_arg('tab', 'documentation', $settings_url);
        ?>
        <div class="wrap">
            <h1>Booked</h1>

            <nav class="nav-tab-wrapper" aria-label="Onglets Booked">
                <a href="<?php echo esc_url($settings_url); ?>" class="nav-tab <?php echo $active_tab === 'settings' ? 'nav-tab-active' : ''; ?>">Configuration</a>
                <a href="<?php echo esc_url($documentation_url); ?>" class="nav-tab <?php echo $active_tab === 'documentation' ? 'nav-tab-active' : ''; ?>">Documentation</a>
            </nav>

            <?php if ($active_tab === 'documentation') : ?>
                <?php $this->render_documentation_tab(); ?>
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

                if (tokenInput && tokenToggle) {
                    tokenToggle.addEventListener('click', function () {
                        var isHidden = tokenInput.type === 'password';
                        tokenInput.type = isHidden ? 'text' : 'password';
                        tokenToggle.textContent = isHidden ? 'Masquer' : 'Révéler';
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
                <p>Affiche le calendrier de disponibilités et, selon le mode choisi, le formulaire de demande de réservation.</p>
                <ul>
                    <li><strong>Gîte</strong> : sélection depuis la liste API ou saisie manuelle de l’identifiant.</li>
                    <li><strong>Mode</strong> : calendrier + formulaire, ou calendrier seul.</li>
                    <li><strong>Mois affichés</strong> : de 1 à 12 mois.</li>
                    <li><strong>Options</strong> : affichage du titre et de la capacité.</li>
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
                <pre><code>[booked_widget gite_id="mon-gite" mode="calendar" months="3" show_title="0" show_capacity="1"]</code></pre>

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
                            <th scope="row"><code>mode</code></th>
                            <td><code>booking</code> pour calendrier + formulaire, ou <code>calendar</code> pour calendrier seul. Valeur par défaut : <code>booking</code>.</td>
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
                    </tbody>
                </table>
            </section>

            <section class="booked-docs__section">
                <h2>Variables de contenu</h2>
                <p>Les variables s’écrivent entre doubles accolades. Le format recommandé est <code>{{gite.nom_de_la_variable}}</code>. Elles sont disponibles dans le bloc <strong>Booked Texte</strong> et dans les blocs Gutenberg natifs si un gîte par défaut est défini pour la page.</p>

                <h3>Gîte par défaut d’une page</h3>
                <p>Dans l’éditeur Gutenberg, ouvrez les réglages de la page ou de l’article, puis le panneau <strong>Booked</strong>. Sélectionnez un gîte. Les blocs natifs de cette page pourront alors utiliser les variables <code>{{gite...}}</code>.</p>

                <h3>Exemples de variables courantes</h3>
                <table>
                    <tbody>
                        <tr>
                            <th scope="row"><code>{{gite.adresse_complete}}</code></th>
                            <td>Adresse complète du gîte.</td>
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
                            <th scope="row"><code>{{gite.prix_nuit_basse_saison}}</code></th>
                            <td>Prix par nuit en basse saison.</td>
                        </tr>
                        <tr>
                            <th scope="row"><code>{{gite.prix_nuit_haute_saison}}</code></th>
                            <td>Prix par nuit en haute saison.</td>
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
