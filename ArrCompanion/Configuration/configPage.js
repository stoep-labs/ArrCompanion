// ArrCompanion settings page. The look, the helpers and the Sonarr / Radarr parts are taken from
// Home Screen Companion's settings page (MIT, soderlund91) and its Stoep fork's Missing tab.
define(['emby-input', 'emby-button', 'emby-checkbox'], function () {
    'use strict';

    var pluginId = '7e28ada3-edf0-4128-88dc-ee2a934866f5';
    var HSC_MIN_VERSION = [4, 5];

    // ---- Helpers (from HSC) ----

    function activeView() {
        return document.querySelector('#ArrCompanionConfigPage:not(.hide):not(.page-hidden)') || document.querySelector('#ArrCompanionConfigPage');
    }

    function isOpaqueBg(c) {
        return !!c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)' && !/rgba\([^)]*,\s*0\)$/.test(c);
    }

    function applyPluginTheme() {
        // Light/dark from the page itself: first non-transparent background up from the page.
        var bg = null;
        var page = activeView();
        for (var a = page; a && a.nodeType === 1; a = a.parentElement) {
            var ac = getComputedStyle(a).backgroundColor;
            if (isOpaqueBg(ac)) { bg = ac; break; }
        }
        var candidates = bg ? [] : ['.skinHeader', '.mainDrawer', '.contentScrollSlider', 'body'];
        for (var i = 0; i < candidates.length; i++) {
            var el = document.querySelector(candidates[i]);
            if (!el) continue;
            var c = getComputedStyle(el).backgroundColor;
            if (c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') { bg = c; break; }
        }
        var isDark = true;
        if (bg) {
            var m = bg.match(/\d+/g);
            if (m) isDark = (parseInt(m[0]) * 0.299 + parseInt(m[1]) * 0.587 + parseInt(m[2]) * 0.114) < 128;
        }
        var root = document.documentElement;
        if (isDark) {
            root.style.setProperty('--plugin-popup-bg',     '#2a2a2a');
            root.style.setProperty('--plugin-popup-bg2',    '#333333');
            root.style.setProperty('--plugin-popup-color',  '#e8e8e8');
            root.style.setProperty('--plugin-popup-muted',  '#aaaaaa');
            root.style.setProperty('--plugin-popup-border', 'rgba(255,255,255,0.12)');
            root.style.setProperty('--plugin-popup-hover',  'rgba(255,255,255,0.08)');
            root.style.setProperty('--plugin-popup-badge',  'rgba(255,255,255,0.1)');
            root.style.setProperty('--plugin-input-border', 'rgba(255,255,255,0.2)');
            root.style.setProperty('--plugin-input-bg',     'rgba(255,255,255,0.08)');
            root.style.setProperty('--plugin-footer-bg',    '#181818');
            root.dataset.pluginTheme = 'dark';
        } else {
            root.style.setProperty('--plugin-popup-bg',     '#f2f2f2');
            root.style.setProperty('--plugin-popup-bg2',    '#e0e0e0');
            root.style.setProperty('--plugin-popup-color',  '#1a1a1a');
            root.style.setProperty('--plugin-popup-muted',  '#555555');
            root.style.setProperty('--plugin-popup-border', 'rgba(0,0,0,0.15)');
            root.style.setProperty('--plugin-popup-hover',  'rgba(0,0,0,0.08)');
            root.style.setProperty('--plugin-popup-badge',  'rgba(0,0,0,0.1)');
            root.style.setProperty('--plugin-input-border', 'rgba(0,0,0,0.28)');
            root.style.setProperty('--plugin-input-bg',     'rgba(0,0,0,0.04)');
            root.style.setProperty('--plugin-footer-bg',    '#c5cad1');
            root.dataset.pluginTheme = 'light';
        }
        var drawer = document.querySelector('.mainDrawer');
        var drawerRight = drawer ? drawer.getBoundingClientRect().right : 0;
        var footerLeft = (drawerRight > 0 && drawerRight < window.innerWidth * 0.5) ? drawerRight : 0;
        root.style.setProperty('--plugin-footer-left', footerLeft + 'px');
    }

    // Emby's own toast (bottom notification).
    function showToast(text) {
        try {
            require(['toast'], function (toast) { (toast && toast.default ? toast.default : toast)(text); });
        } catch (e) { }
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildModalShell() {
        var modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.renderBox = function (content) {
            modal.innerHTML =
                '<div style="background:var(--plugin-popup-bg,#2a2a2a);color:var(--plugin-popup-color,#e8e8e8);' +
                'border:1px solid var(--plugin-popup-border,rgba(255,255,255,0.12));border-radius:12px;box-shadow:var(--hsc-shadow-modal);overscroll-behavior:contain;' +
                'padding:28px;max-width:560px;width:90%;max-height:85vh;overflow-y:auto;position:relative;">' +
                '<button type="button" class="btnShellClose" aria-label="Close" title="Close" style="position:absolute;top:22px;right:18px;background:transparent;border:none;color:inherit;cursor:pointer;padding:2px;opacity:0.6;line-height:1;"><i class="md-icon">close</i></button>' +
                content + '</div>';
            modal.querySelector('.btnShellClose').addEventListener('click', function () { modal.close(); });
        };
        function onEsc(e) { if (e.key === 'Escape') modal.close(); }
        modal.close = function () { modal.remove(); document.removeEventListener('keydown', onEsc); };
        document.addEventListener('keydown', onEsc);
        modal.addEventListener('click', function (e) { if (e.target === modal && !modal.dataset.busy) modal.close(); });
        document.body.appendChild(modal);
        return modal;
    }
    var _modalTitleStyle = 'margin:0 0 6px;font-size:1.05em;font-weight:600;letter-spacing:-0.1px;';

    function postJson(path, body) {
        return fetch(window.ApiClient.getUrl(path), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-MediaBrowser-Token': window.ApiClient.accessToken() },
            body: JSON.stringify(body)
        }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    function getJson(path, params) {
        return fetch(window.ApiClient.getUrl(path, params), { headers: { 'X-MediaBrowser-Token': window.ApiClient.accessToken() } })
            .then(function (r) { if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); });
    }

    function versionAtLeast(v, min) {
        var p = String(v || '').split('.').map(function (x) { return parseInt(x, 10) || 0; });
        for (var i = 0; i < min.length; i++) {
            if ((p[i] || 0) > min[i]) return true;
            if ((p[i] || 0) < min[i]) return false;
        }
        return true;
    }

    // ---- Sonarr & Radarr (from the HSC fork's Missing tab) ----

    function arrConfigured(cfg) {
        function set(v) { return !!(v || '').trim(); }
        return !!cfg && ((set(cfg.SonarrUrl) && set(cfg.SonarrApiKey)) || (set(cfg.RadarrUrl) && set(cfg.RadarrApiKey)));
    }

    // Test Connection with the URL and key as typed (Sonarr / Radarr system/status).
    function testArrConnection(view, btn) {
        var kind = btn.dataset.kind, name = kind === 'sonarr' ? 'Sonarr' : 'Radarr';
        var out = view.querySelector('.arr-test-result[data-kind="' + kind + '"]');
        btn.disabled = true;
        out.style.color = '';
        out.textContent = 'Testing…';
        postJson('ArrCompanion/Test', {
            Kind: kind, Url: view.querySelector('#txt' + name + 'Url').value, ApiKey: view.querySelector('#txt' + name + 'ApiKey').value
        }).then(function (res) {
            out.textContent = res.Message;
            out.style.color = res.Success ? 'var(--hsc-primary-text)' : 'var(--hsc-danger-text)';
        }).catch(function (err) {
            out.textContent = 'Connection failed: ' + err.message;
            out.style.color = 'var(--hsc-danger-text)';
        }).then(function () { btn.disabled = false; });
    }

    // Add to Sonarr / Radarr: root folder (the last one used is picked) and quality profile
    // (HD-1080p when there is one); Radarr also minimum availability and Monitored.
    function openArrAddDialog(kind, title, sourceId, onAdded) {
        var isTv = kind === 'sonarr';
        var name = isTv ? 'Sonarr' : 'Radarr';
        var fieldStyle = 'width:100%; box-sizing:border-box; padding:7px 9px; font-size:inherit; color:inherit; background:var(--plugin-input-bg,rgba(255,255,255,0.08)); border:1px solid var(--plugin-input-border,rgba(255,255,255,0.2)); border-radius:6px;';
        function field(label, html) { return '<div style="margin-bottom:14px;"><label style="display:block; font-size:0.85em; opacity:0.75; margin-bottom:4px;">' + label + '</label>' + html + '</div>'; }
        var idLabel = /^tt/i.test(sourceId) ? 'IMDb ID' : (isTv ? 'TVDb ID' : 'TMDb ID');
        var modal = buildModalShell();
        modal.renderBox(
            '<h3 style="' + _modalTitleStyle + '">' + (isTv ? 'Add show to Sonarr' : 'Add movie to Radarr') + '</h3>' +
            field('Title', '<input type="text" readonly class="arr-title" style="' + fieldStyle + ' opacity:0.8;" />') +
            field(idLabel, '<input type="text" readonly class="arr-id" style="' + fieldStyle + ' opacity:0.8;" />') +
            field('Root Folder', '<select class="arr-root" style="' + fieldStyle + '"><option>Loading…</option></select>') +
            field('Quality Profile', '<select class="arr-quality" style="' + fieldStyle + '"><option>Loading…</option></select>') +
            (isTv ? '' :
                field('Minimum Availability', '<select class="arr-avail" style="' + fieldStyle + '">' +
                    '<option value="announced">Announced</option><option value="inCinemas">In Cinemas</option>' +
                    '<option value="released">Released</option></select>') +
                '<label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;"><input type="checkbox" class="arr-monitored" checked /> Monitored</label>') +
            '<div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;margin-top:18px;">' +
            '<button type="button" class="arr-cancel hsc-mbtn hsc-btn-secondary">Cancel</button>' +
            '<button type="button" class="arr-add hsc-mbtn hsc-btn-primary" disabled>Add to ' + name + '</button>' +
            '</div>'
        );
        modal.querySelector('.arr-title').value = title;
        modal.querySelector('.arr-id').value = sourceId;
        modal.querySelector('.arr-cancel').addEventListener('click', modal.close);
        var addBtn = modal.querySelector('.arr-add');

        getJson('ArrCompanion/Options', { Kind: kind }).then(function (res) {
            if (!res.Success) { showToast(res.Message); modal.close(); return; }
            var rootSel = modal.querySelector('.arr-root');
            rootSel.innerHTML = (res.RootFolders || []).map(function (p) { return '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + '</option>'; }).join('');
            if (res.LastRootFolderPath && (res.RootFolders || []).indexOf(res.LastRootFolderPath) !== -1) rootSel.value = res.LastRootFolderPath;
            var qSel = modal.querySelector('.arr-quality');
            var hd = null;
            qSel.innerHTML = (res.QualityProfiles || []).map(function (p) {
                var n = (p.Name || '').toLowerCase();
                if (n.indexOf('hd-1080p') !== -1 || n.indexOf('hd 1080p') !== -1) hd = String(p.Id);
                return '<option value="' + p.Id + '">' + escapeHtml(p.Name) + '</option>';
            }).join('');
            if (hd) qSel.value = hd;
            addBtn.disabled = !(res.RootFolders || []).length || !(res.QualityProfiles || []).length;
        }).catch(function (err) { showToast(name + ' could not be read: ' + (err && err.message || err)); modal.close(); });

        addBtn.addEventListener('click', function () {
            addBtn.disabled = true;
            addBtn.textContent = 'Adding…';
            var req = {
                Kind: kind, SourceId: sourceId, Title: title,
                QualityProfileId: parseInt(modal.querySelector('.arr-quality').value, 10) || 0,
                RootFolderPath: modal.querySelector('.arr-root').value || ''
            };
            if (!isTv) {
                req.MinimumAvailability = modal.querySelector('.arr-avail').value;
                req.Monitored = modal.querySelector('.arr-monitored').checked;
            }
            postJson('ArrCompanion/Add', req).then(function (res) {
                showToast(res.Message);
                if (res.Success || res.AlreadyIn) { modal.close(); if (onAdded) onAdded(); return; }
                addBtn.disabled = false;
                addBtn.textContent = 'Add to ' + name;
            }).catch(function (err) {
                showToast('Not added: ' + (err && err.message || err));
                addBtn.disabled = false;
                addBtn.textContent = 'Add to ' + name;
            });
        });
    }

    // ---- Missing titles (Home Screen Companion's list) ----

    // A title's lists as [{ Name, Place }]. HSC 4.5 sends Lists as names; a later HSC may send
    // objects { Name, Place } in Lists, or a ListPlaces array beside the names.
    function normLists(t) {
        var places = {};
        (t.ListPlaces || []).forEach(function (lp) { if (lp && lp.Name) places[lp.Name] = lp.Place; });
        return (t.Lists || []).map(function (l) {
            var n = typeof l === 'string' ? l : (l && (l.Name || l.name)) || '';
            var p = typeof l === 'string' ? places[n] : l && (l.Place != null ? l.Place : l.place);
            p = parseInt(p, 10);
            return { Name: n, Place: p > 0 ? p : null };
        }).filter(function (l) { return l.Name; });
    }
    function bestPlace(lists) {
        var best = null;
        lists.forEach(function (l) { if (l.Place && (best === null || l.Place < best)) best = l.Place; });
        return best;
    }

    // ---- Missing tab: the Stoep fork's (4.4.2) Missing tab, fed by Home Screen Companion 4.5's list ----
    // Class names carry an ac prefix (acm-, acs-): Home Screen Companion's own page uses mt- and stm-,
    // and both pages stay in the document.

    function stateLine(view, text) {
        view.querySelector('#missingContainer').innerHTML =
            '<div class="acm-head"><h2 class="sectionTitle">Missing</h2>' +
            '<button is="emby-button" type="button" class="raised btn-neutral acm-refresh"><i class="md-icon" style="margin-right:5px;">refresh</i><span>Refresh</span></button></div>' +
            '<div class="acm-empty">' + escapeHtml(text) + '</div>';
    }

    function loadMissing(view) {
        var container = view.querySelector('#missingContainer');
        container._mtArrGen = (container._mtArrGen || 0) + 1;
        var busy = container.querySelector('.acm-refresh');
        if (busy) { busy.disabled = true; busy.querySelector('span').textContent = 'Refreshing…'; }
        else container.innerHTML = '<div style="padding:20px;color:var(--theme-text-secondary);">Loading…</div>';
        getJson('ArrCompanion/Hsc').then(function (hsc) {
            if (!hsc.Installed) { stateLine(view, 'Home Screen Companion is not installed.'); return; }
            if (!versionAtLeast(hsc.Version, HSC_MIN_VERSION)) { stateLine(view, 'Home Screen Companion 4.5 or later is needed (installed: ' + hsc.Version + ').'); return; }
            if (hsc.ShowMissingTitles === false) { stateLine(view, 'Show missing titles is off in Home Screen Companion.'); return; }
            return getJson('HomeScreenCompanion/MissingTitles').then(function (data) {
                if (!data || !data.HasData) { stateLine(view, 'Home Screen Companion has no missing titles yet.'); return; }
                renderMissing(view, container, data);
            });
        }).catch(function (err) {
            stateLine(view, 'Home Screen Companion\'s missing titles could not be read (' + (err && err.message || err) + ').');
        });
    }

    function renderMissing(view, container, data) {
        var esc = escapeHtml;
        var state = container._mt || (container._mt = { filter: 'all', list: '', sort: 'rank', search: '', view: 'list' });
        try { state.view = localStorage.getItem('ArrCompanion_MissingView') || state.view; } catch (e) { }

        // Home Screen Companion 4.5's movies and shows as the fork's items: one list, a type per title.
        var items = (data.Movies || []).map(function (m) { return toItem(m, 'movie'); })
            .concat((data.Shows || []).map(function (s) { return toItem(s, 'tv'); }));
        function toItem(t, type) {
            var lists = normLists(t).map(function (l) { return { Group: l.Name, Rank: l.Place }; });
            var ranks = lists.map(function (l) { return l.Rank; }).filter(function (r) { return r; });
            return {
                Title: t.Name || '', Year: t.Year || 0, MediaType: type, Imdb: t.Imdb || '', Tmdb: t.Tmdb || '', Tvdb: t.Tvdb || '',
                Lists: lists, Rank: ranks.length ? Math.min.apply(null, ranks) : 0, Poster: '',
                InLibrary: type === 'tv' && !!t.LibraryId
            };
        }
        var hasRank = items.some(function (it) { return it.Rank; });
        if (!hasRank && state.sort === 'rank') state.sort = 'title';
        var sources = {};
        items.forEach(function (it) { it.Lists.forEach(function (l) { sources[l.Group] = (sources[l.Group] || 0) + 1; }); });
        sources = Object.keys(sources).sort(function (a, b) { return a.localeCompare(b); }).map(function (g) { return { Group: g, MissingCount: sources[g] }; });

        var arr = { status: {}, sonarr: false, radarr: false };
        if (state.list && !sources.some(function (s) { return s.Group === state.list; })) state.list = '';
        var movies = items.filter(function (i) { return i.MediaType === 'movie'; }).length;
        var shows = items.filter(function (i) { return i.MediaType === 'tv'; }).length;
        var checked = data.UpdatedUtc ? new Date(data.UpdatedUtc) : null;

        container.innerHTML =
            '<div class="acm-head">' +
                '<h2 class="sectionTitle">Missing</h2>' +
                '<span class="acm-count">' + items.length + '</span>' +
                '<span class="acm-checked">' + (checked ? 'Checked ' + esc(checked.toLocaleString()) : '') + '</span>' +
                '<button is="emby-button" type="button" class="raised btn-neutral acm-refresh"><i class="md-icon" style="margin-right:5px;">refresh</i><span>Refresh</span></button>' +
            '</div>' +
            '<div class="acm-controls">' +
                '<input type="search" class="acm-search" placeholder="Search" autocomplete="off" value="' + esc(state.search) + '" />' +
                '<select class="acm-listsel"><option value="">All sources</option>' +
                    sources.map(function (s) {
                        return '<option value="' + esc(s.Group) + '"' + (s.Group === state.list ? ' selected' : '') + '>' + esc(s.Group) + ' · ' + s.MissingCount + '</option>';
                    }).join('') +
                '</select>' +
                '<select class="acm-sort">' +
                    (hasRank ? [['rank', 'Rank']] : []).concat([['title', 'Title'], ['year', 'Year'], ['lists', 'Sources']]).map(function (o) {
                        return '<option value="' + o[0] + '"' + (o[0] === state.sort ? ' selected' : '') + '>' + o[1] + '</option>';
                    }).join('') +
                '</select>' +
            '</div>' +
            '<div class="acm-bar">' +
                '<button type="button" class="acs-chip" data-filter="all"><i class="md-icon">list</i>All ' + items.length + '</button>' +
                '<button type="button" class="acs-chip" data-filter="movie"><i class="md-icon">movie</i>Movies ' + movies + '</button>' +
                '<button type="button" class="acs-chip" data-filter="tv"><i class="md-icon">tv</i>Shows ' + shows + '</button>' +
                '<div class="acm-view">' +
                    '<button type="button" data-view="list" title="List"><i class="md-icon">view_list</i></button>' +
                    '<button type="button" data-view="grid" title="Posters"><i class="md-icon">grid_view</i></button>' +
                '</div>' +
            '</div>' +
            '<div id="mtArrError"></div>' +
            '<div class="acm-body' + (hasRank ? '' : ' acm-norank') + '"></div>';

        var body = container.querySelector('.acm-body');

        function visible() {
            var q = state.search.trim().toLowerCase();
            var out = [];
            items.forEach(function (it, idx) {
                if (state.filter !== 'all' && it.MediaType !== state.filter) return;
                if (state.list && !it.Lists.some(function (l) { return l.Group === state.list; })) return;
                if (q && it.Title.toLowerCase().indexOf(q) === -1 && it.Imdb.toLowerCase().indexOf(q) === -1) return;
                out.push(idx);
            });
            function rankOf(it) {
                if (!state.list) return it.Rank || 1e9;
                var l = it.Lists.filter(function (x) { return x.Group === state.list; })[0];
                return (l && l.Rank) || 1e9;
            }
            out.sort(function (a, b) {
                var x = items[a], y = items[b], d = 0;
                if (state.sort === 'title') d = x.Title.localeCompare(y.Title);
                else if (state.sort === 'year') d = (y.Year || 0) - (x.Year || 0);
                else if (state.sort === 'lists') d = y.Lists.length - x.Lists.length;
                return d || (rankOf(x) - rankOf(y)) || x.Title.localeCompare(y.Title);
            });
            return out;
        }

        function arrCell(idx) {
            var st = arr.status[idx];
            if (!st) return '';
            var isTv = st.Type === 'show';
            if ((isTv && !arr.sonarr) || (!isTv && !arr.radarr)) return '';
            var name = isTv ? 'Sonarr' : 'Radarr';
            if (st.In) {
                var detail = isTv
                    ? (st.Monitored ? 'monitored' : 'unmonitored') + (st.Episodes > 0 ? ', ' + st.EpisodeFiles + ' of ' + st.Episodes + ' episodes' : '')
                    : (st.Monitored ? 'monitored' : 'unmonitored') + ', ' + (st.Downloaded ? 'downloaded' : 'not downloaded');
                return '<button type="button" class="acs-arr in" disabled title="In ' + name + ': ' + detail + '"><i class="md-icon">check</i>' + name + '</button>';
            }
            // Sonarr adds by TVDb id (else IMDb), Radarr by IMDb id (else TMDb).
            var id = isTv ? (st.Tvdb || st.Imdb) : (st.Imdb || st.Tmdb);
            if (!id) return '<button type="button" class="acs-arr" disabled title="No id to add it by"><i class="md-icon">help_outline</i></button>';
            return '<button type="button" class="acs-arr add" data-idx="' + idx + '" data-id="' + esc(id) + '" title="Add to ' + name + '"><i class="md-icon">add</i>' + name + '</button>';
        }

        function imdbLink(it) {
            return it.Imdb ? '<a href="https://www.imdb.com/title/' + encodeURIComponent(it.Imdb) + '/" target="_blank" rel="noopener">' + esc(it.Imdb) + '</a>' : '';
        }

        function listChips(it) {
            return it.Lists.map(function (l) {
                return '<span class="acm-src">' + esc(l.Group) + (l.Rank ? ' <b>#' + l.Rank + '</b>' : '') + '</span>';
            }).join('') + (it.InLibrary ? '<span class="acm-src">In library</span>' : '');
        }

        function posterStyle(it) { return it.Poster ? ' style="background-image:url(&quot;' + esc(it.Poster) + '&quot;)"' : ''; }

        function rowHtml(idx) {
            var it = items[idx];
            var poster = '<div class="acs-poster" data-poster="' + idx + '"' + posterStyle(it) + '>' + (it.Poster ? '' : '<i class="md-icon">' + (it.MediaType === 'tv' ? 'tv' : 'movie') + '</i>') + '</div>';
            var meta = [];
            if (it.Year) meta.push(it.Year);
            meta.push(it.MediaType === 'tv' ? 'Series' : 'Movie');
            if (it.Imdb) meta.push(imdbLink(it));
            return '<div class="acs-row" data-idx="' + idx + '">' +
                '<div class="acs-rank">' + (it.Rank || '') + '</div>' +
                poster +
                '<div class="acs-info">' +
                    '<div class="acs-title">' + esc(it.Title || it.Imdb) + '</div>' +
                    '<div class="acs-meta">' + meta.join(' · ') + '</div>' +
                    '<div class="acm-lists">' + listChips(it) + '</div>' +
                '</div>' +
                '<div class="acm-arr">' + arrCell(idx) + '</div>' +
            '</div>';
        }

        function cardHtml(idx) {
            var it = items[idx];
            var href = it.Imdb ? 'https://www.imdb.com/title/' + encodeURIComponent(it.Imdb) + '/' : '';
            var cover = (href ? '<a class="acm-cover" href="' + href + '" target="_blank" rel="noopener"' : '<div class="acm-cover"') +
                ' data-poster="' + idx + '"' + posterStyle(it) + '>' + (it.Poster ? '' : '<i class="md-icon">' + (it.MediaType === 'tv' ? 'tv' : 'movie') + '</i>') +
                (it.Rank ? '<span class="acm-rank">#' + it.Rank + '</span>' : '') +
                (href ? '</a>' : '</div>');
            var meta = [];
            if (it.Year) meta.push(it.Year);
            meta.push(esc(it.Lists.map(function (l) { return l.Group; }).join(', ')));
            return '<div class="acm-card" data-idx="' + idx + '">' + cover +
                '<div class="acm-ctitle">' + esc(it.Title || it.Imdb) + '</div>' +
                '<div class="acm-cmeta">' + meta.join(' · ') + '</div>' +
                '<div class="acm-arr">' + arrCell(idx) + '</div>' +
            '</div>';
        }

        function renderBody() {
            container.querySelectorAll('.acm-bar .acs-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.filter === state.filter); });
            container.querySelectorAll('.acm-view button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === state.view); });
            var idxs = visible();
            if (!idxs.length) { body.innerHTML = '<div class="acm-empty">' + (items.length ? 'Nothing to show.' : 'Nothing missing.') + '</div>'; return; }
            body.innerHTML = state.view === 'grid'
                ? '<div class="acm-grid">' + idxs.map(cardHtml).join('') + '</div>'
                : '<div class="acm-list">' + idxs.map(rowHtml).join('') + '</div>';
        }

        function paintArr() {
            body.querySelectorAll('[data-idx] > .acm-arr').forEach(function (cell) {
                var html = arrCell(parseInt(cell.parentNode.dataset.idx, 10));
                if (cell.innerHTML !== html) cell.innerHTML = html;
            });
        }

        // Sonarr / Radarr status, 100 titles per request so the first ones show quickly.
        function loadArrStatus() {
            if (view.classList.contains('hsc-no-arr') || !items.length) return;
            var my = (container._mtArrGen = (container._mtArrGen || 0) + 1);
            var errors = {};
            (function next(start) {
                if (my !== container._mtArrGen || start >= items.length) return;
                var chunk = items.slice(start, start + 100);
                postJson('ArrCompanion/Status', { Items: chunk.map(function (it) { return { Type: it.MediaType === 'tv' ? 'show' : 'movie', Imdb: it.Imdb, Tmdb: it.Tmdb, Tvdb: it.Tvdb }; }) })
                    .then(function (res) {
                        if (my !== container._mtArrGen) return;
                        arr.sonarr = !!res.SonarrConfigured && !res.SonarrError;
                        arr.radarr = !!res.RadarrConfigured && !res.RadarrError;
                        (res.Items || []).forEach(function (st, k) { arr.status[start + k] = st; });
                        if (res.SonarrError) errors.Sonarr = res.SonarrError;
                        if (res.RadarrError) errors.Radarr = res.RadarrError;
                        var box = container.querySelector('#mtArrError');
                        if (box) box.innerHTML = Object.keys(errors).map(function (n) {
                            return '<div class="hsc-callout danger" style="margin-bottom:12px;"><i class="md-icon">error</i><span>' + n + ' could not be read: ' + esc(errors[n]) + '</span></div>';
                        }).join('');
                        paintArr();
                        next(start + 100);
                    }).catch(function (err) {
                        var box = container.querySelector('#mtArrError');
                        if (box && my === container._mtArrGen) box.innerHTML = '<div class="hsc-callout danger" style="margin-bottom:12px;"><i class="md-icon">error</i><span>Sonarr / Radarr could not be read (' + esc(err.message) + ').</span></div>';
                    });
            })(0);
        }

        // Posters: Emby's metadata search by the title's ids (ArrCompanion/Posters), 60 per request.
        function loadPosters() {
            var my = (container._mtPosterGen = (container._mtPosterGen || 0) + 1);
            var order = visible().concat(items.map(function (x, i) { return i; }));
            var seen = {}, wanted = order.filter(function (i) { if (seen[i]) return false; seen[i] = true; return items[i].Imdb || items[i].Tmdb || items[i].Tvdb; });
            (function next(start) {
                if (container._mtPosterGen !== my || start >= wanted.length) return;
                var chunk = wanted.slice(start, start + 60);
                postJson('ArrCompanion/Posters', { Items: chunk.map(function (i) { var it = items[i]; return { Type: it.MediaType === 'tv' ? 'show' : 'movie', Imdb: it.Imdb, Tmdb: it.Tmdb, Tvdb: it.Tvdb }; }) })
                    .then(function (res) {
                        (res.Urls || []).forEach(function (url, k) {
                            if (!url) return;
                            var idx = chunk[k];
                            items[idx].Poster = url;
                            body.querySelectorAll('[data-poster="' + idx + '"]').forEach(function (el) {
                                el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
                                var icon = el.querySelector(':scope > .md-icon');
                                if (icon) icon.remove();
                            });
                        });
                        next(start + 60);
                    }).catch(function () { });
            })(0);
        }

        container.querySelector('.acm-refresh').addEventListener('click', function () { loadMissing(view); });
        container.querySelector('.acm-search').addEventListener('input', function () { state.search = this.value; renderBody(); });
        container.querySelector('.acm-listsel').addEventListener('change', function () { state.list = this.value; renderBody(); });
        container.querySelector('.acm-sort').addEventListener('change', function () { state.sort = this.value; renderBody(); });
        container.querySelector('.acm-bar').addEventListener('click', function (e) {
            var chip = e.target.closest('.acs-chip');
            if (chip) { state.filter = chip.dataset.filter; renderBody(); return; }
            var v = e.target.closest('.acm-view button');
            if (v) {
                state.view = v.dataset.view;
                try { localStorage.setItem('ArrCompanion_MissingView', state.view); } catch (err) { }
                renderBody();
            }
        });
        body.addEventListener('click', function (e) {
            var b = e.target.closest('.acs-arr.add');
            if (!b) return;
            var it = items[parseInt(b.dataset.idx, 10)];
            if (!it) return;
            openArrAddDialog(it.MediaType === 'tv' ? 'sonarr' : 'radarr', it.Title, b.dataset.id, loadArrStatus);
        });
        renderBody();
        loadArrStatus();
        loadPosters();
    }

    // ---- Settings ----

    var FIELDS = ['SonarrUrl', 'SonarrApiKey', 'RadarrUrl', 'RadarrApiKey'];

    // Save Settings is on only when a field differs from what was loaded or saved (as in HSC).
    function formState(view) { return JSON.stringify(FIELDS.map(function (f) { return view.querySelector('#txt' + f).value.trim(); })); }
    function checkFormState(view) {
        var btn = view.querySelector('.btn-save');
        var dirty = view._acSaved !== undefined && formState(view) !== view._acSaved;
        btn.disabled = !dirty;
        btn.style.opacity = dirty ? '1' : '0.5';
    }

    function loadConfig(view) {
        return window.ApiClient.getPluginConfiguration(pluginId).then(function (cfg) {
            FIELDS.forEach(function (f) { view.querySelector('#txt' + f).value = cfg[f] || ''; });
            view.classList.toggle('hsc-no-arr', !arrConfigured(cfg));
            view._acSaved = formState(view);
            checkFormState(view);
        });
    }

    function saveConfig(view) {
        window.ApiClient.getPluginConfiguration(pluginId).then(function (cfg) {
            var was = arrConfigured(cfg) ? JSON.stringify(FIELDS.map(function (f) { return (cfg[f] || '').trim(); })) : '';
            FIELDS.forEach(function (f) { cfg[f] = view.querySelector('#txt' + f).value.trim(); });
            return window.ApiClient.updatePluginConfiguration(pluginId, cfg).then(function (result) {
                if (window.Dashboard && Dashboard.processPluginConfigurationUpdateResult) Dashboard.processPluginConfigurationUpdateResult(result);
                else showToast('Settings saved.');
                view.classList.toggle('hsc-no-arr', !arrConfigured(cfg));
                view._acSaved = formState(view);
                checkFormState(view);
                var now = arrConfigured(cfg) ? JSON.stringify(FIELDS.map(function (f) { return cfg[f]; })) : '';
                if (now !== was) loadMissing(view);
            });
        }).catch(function (err) { showToast('Not saved: ' + (err && err.message || err)); });
    }

    // Footer: the installed version, and a newer release on GitHub (silent when it can't be read).
    function loadFooter(view) {
        window.ApiClient.getInstalledPlugins().then(function (plugins) {
            var me = (plugins || []).filter(function (p) { return (p.Id || '').toLowerCase() === pluginId; })[0];
            if (!me) return;
            var ver = me.Version || '';
            view.querySelector('#footerVersionText').innerHTML = '<a href="https://github.com/stoep-labs/ArrCompanion/releases" target="_blank" style="color:inherit;text-decoration:none;">v' + escapeHtml(ver) + '</a>';
            fetch('https://api.github.com/repos/stoep-labs/ArrCompanion/releases/latest')
                .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
                .then(function (release) {
                    var latest = (release.tag_name || '').replace(/^v/i, '');
                    if (!latest || versionAtLeast(ver, latest.split('.').map(Number))) return;
                    view.querySelector('#acFooterUpdateSep').style.display = '';
                    view.querySelector('#acFooterUpdateInfo').innerHTML = '<a class="footer-update-link" href="' + escapeHtml(release.html_url || 'https://github.com/stoep-labs/ArrCompanion/releases') + '" target="_blank">v' + escapeHtml(latest) + ' available</a>';
                }).catch(function () { });
        });
    }

    return function (view) {
        var bound = false;

        function showPageTab(target) {
            view.querySelectorAll('.page-tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.pageTab === target); });
            view.querySelectorAll('.page-tab-content').forEach(function (c) { c.style.display = c.id === 'tab' + target ? '' : 'none'; });
        }

        view.addEventListener('viewshow', function () {
            applyPluginTheme();
            // Emby can set its theme just after viewshow on a fresh load: check again once painted.
            setTimeout(applyPluginTheme, 500);
            // And whenever a popup opens (as HSC does): a capture listener runs before the open handler.
            if (!window._acThemeClickHook) {
                window._acThemeClickHook = true;
                document.addEventListener('click', function () {
                    var v = activeView();
                    if (v && v.isConnected && v.offsetParent !== null) applyPluginTheme();
                }, true);
            }
            loadConfig(view).then(function () { loadMissing(view); }, function () { loadMissing(view); });
            loadFooter(view);
            if (bound) return;
            bound = true;

            view.querySelectorAll('.page-tab-btn').forEach(function (btn) {
                btn.addEventListener('click', function () { showPageTab(btn.dataset.pageTab); });
            });
                        view.querySelector('.btn-save').addEventListener('click', function () { if (!this.disabled) saveConfig(view); });
            view.addEventListener('input', function (e) { if (e.target.closest('#tabSettings')) checkFormState(view); });

            var helpOverlay = view.querySelector('#helpModalOverlay');
            view.querySelector('#btnOpenHelp').addEventListener('click', function () { helpOverlay.classList.add('modal-visible'); });
            view.querySelector('#btnCloseHelp').addEventListener('click', function () { helpOverlay.classList.remove('modal-visible'); });
            helpOverlay.addEventListener('click', function (e) {
                if (e.target === helpOverlay || e.target.closest('[data-close="btnCloseHelp"]')) helpOverlay.classList.remove('modal-visible');
            });

            view.addEventListener('change', function (e) {
                var cb = e.target.closest('.chkShowApiKey');
                if (!cb) return;
                var input = view.querySelector('#' + cb.dataset.target);
                if (input) input.classList.toggle('api-key-shown', cb.checked);
            });
            view.addEventListener('click', function (e) {
                var test = e.target.closest('.btnTestArr');
                if (test) { testArrConnection(view, test); return; }
                var header = e.target.closest('.settings-panel-toggle');
                if (!header) return;
                var panel = header.closest('.settings-panel');
                var body = panel && panel.querySelector('.settings-panel-body');
                var chevron = header.querySelector('.settings-panel-chevron');
                if (!body) return;
                var isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : 'block';
                if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        });
    };
});
