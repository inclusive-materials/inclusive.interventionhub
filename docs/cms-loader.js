/**
 * Inclusive Intervention Hub — CMS content loader (Sveltia / Git-backed JSON & Markdown)
 * Fetches site root-relative paths under /_data/… Graceful no-op on 404 or errors.
 *
 * GitHub API (below) is only used to list filenames under docs/_data/resources and docs/_data/blog,
 * because GitHub Pages does not serve directory indexes. If you fork this repo or rename it,
 * keep these in sync with docs/admin/config.yml → backend.repo and backend.branch.
 *
 * Blog posts also read docs/_data/blog/manifest.json (updated by CI when you push new .md files)
 * so listings still work if api.github.com is blocked (ad blockers, strict networks).
 *
 * Publishing (GitHub Pages): docs/.nojekyll is required so Jekyll does not strip folders whose names
 * start with "_" — otherwise /_data/ URLs return 404 on the live site.
 */

(function () {
  'use strict';

  /** Owner/repo slug, same as backend.repo in admin/config.yml (e.g. inclusive-materials/inclusive.materials). */
  var GITHUB_REPO = 'inclusive-materials/inclusive.materials';
  /** Same as backend.branch in admin/config.yml (usually main). */
  var GITHUB_BRANCH = 'main';

  var SVG_PLACEHOLDER =
    '<svg class="product-card__placeholder" width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="6" width="36" height="36" rx="6" stroke="currentColor" stroke-width="2"/><path d="M16 24h16M24 16v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var ARTICLE_ICON_SVG =
    '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M8 8h16M8 14h16M8 20h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  var DATE_ICON_SMALL =
    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 3.5V6l1.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

  var DATE_ICON_MEDIUM =
    '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 4V6.5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

  function escapeHtml(text) {
    if (text == null || text === '') return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function renderMarked(markdown) {
    if (!markdown || typeof markdown !== 'string') return '';
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        return marked.parse(markdown, { mangle: false, headerIds: false });
      } catch (e) {
        return escapeHtml(markdown);
      }
    }
    return escapeHtml(markdown);
  }

  function fetchJson(path) {
    return fetch(path)
      .then(function (res) {
        if (!res.ok) return Promise.reject(new Error('not ok'));
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function fetchText(path) {
    return fetch(path)
      .then(function (res) {
        if (!res.ok) return Promise.reject(new Error('not ok'));
        return res.text();
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * List files in repo folder via GitHub API (public repo, unauthenticated).
   * Returns [] on failure (rate limit, network, etc.).
   */
  function listRepoFolder(repoDirPath) {
    var pathSeg = String(repoDirPath || '').replace(/^\/+/, '');
    var url =
      'https://api.github.com/repos/' +
      GITHUB_REPO +
      '/contents/' +
      pathSeg +
      '?ref=' +
      encodeURIComponent(GITHUB_BRANCH);
    return fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
      .then(function (res) {
        if (!res.ok) return Promise.reject(new Error('github list failed'));
        return res.json();
      })
      .catch(function () {
        return [];
      });
  }

  function applyDataCmsFields(root, data) {
    if (!root || !data) return;
    root.querySelectorAll('[data-cms]').forEach(function (el) {
      var key = el.getAttribute('data-cms');
      if (!key || !(key in data) || data[key] == null || data[key] === '') return;
      var val = data[key];
      if (key === 'email' && el.tagName === 'A') {
        var email = String(val).trim();
        el.setAttribute('href', 'mailto:' + email);
        el.textContent = email;
        return;
      }
      if (key === 'hero_title' || key === 'bio_full') {
        el.innerHTML = key === 'bio_full' ? renderMarked(val) : String(val);
      } else {
        el.textContent = typeof val === 'string' ? val : String(val);
      }
    });
    root.querySelectorAll('[data-cms-src]').forEach(function (el) {
      var key = el.getAttribute('data-cms-src');
      if (!key || !(key in data) || !data[key]) return;
      el.setAttribute('src', data[key]);
      el.classList.remove('hidden');
    });
    root.querySelectorAll('[data-cms-href]').forEach(function (el) {
      var key = el.getAttribute('data-cms-href');
      if (!key || !(key in data) || !data[key]) return;
      el.setAttribute('href', data[key]);
      el.classList.remove('hidden');
    });
  }

  function hideEmptySocial(root, data, keys) {
    keys.forEach(function (key) {
      if (!data[key] || String(data[key]).trim() === '') {
        root.querySelectorAll('[data-cms-href="' + key + '"]').forEach(function (el) {
          el.classList.add('hidden');
        });
      }
    });
  }

  function normalizeResource(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      title: raw.title || '',
      description: raw.description || '',
      price: raw.price || '',
      badge: raw.badge || '',
      image: raw.image || '',
      url: raw.url || './shop.html',
      featured: raw.featured !== false,
      audience: raw.audience || 'all',
      category: raw.category || 'all',
      searchTags: raw.searchTags || '',
      originalPrice: raw.originalPrice || '',
      previewFile: raw.previewFile || '',
      pricingTiers: Array.isArray(raw.pricingTiers) ? raw.pricingTiers : [],
    };
  }

  function formatPrice(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (s.charAt(0) === '₱' || s.charAt(0) === '$') return s;
    var n = parseFloat(s);
    if (isNaN(n)) return s;
    var hasCents = Math.round(n * 100) % 100 !== 0;
    var formatted = n.toLocaleString('en-PH', {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    });
    return '₱' + formatted;
  }

  /**
   * Renders a resource's full details flat on the shop page (no card box,
   * no click-to-reveal) — image, title, complete description, and full
   * checklist are all visible immediately. Only "Team & Site Licensing"
   * collapses, via a native <details> disclosure, since that tier table is
   * the one section most visitors don't need up front.
   */
  function buildResourceDetailBlock(resource, index) {
    var r = normalizeResource(resource);
    if (!r || !r.title) return '';

    // audience/category default to 'all' so entries still match every shop filter pill
    var aud = String(r.audience || 'all').toLowerCase().trim();
    var cat = String(r.category || 'all').toLowerCase().trim();
    var titleLower = r.title.toLowerCase();
    var searchTags = String(r.searchTags || '').toLowerCase();
    var parsed = parseResourceFull(r.description);

    var imgHtml = r.image
      ? '<img src="' + escapeHtml(r.image) + '" alt="' + escapeHtml(r.title) +
        '" loading="lazy" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:12px;" />'
      : '<div style="color:#90a89a;">' + SVG_PLACEHOLDER + '</div>';

    // ── Badges — absolutely positioned over the visual ──────────────────────
    var badgeHtml = '';
    if (r.badge) {
      var bl = r.badge.toLowerCase();
      var bColor = (bl === 'bundle' || bl === 'sale') ? '#E53935'
                 : (bl === 'featured' || bl === 'popular' || bl === 'best seller') ? '#F9A825'
                 : '#00897B';
      badgeHtml =
        '<span class="resource-detail__badge" style="background:' + bColor + ';">' +
        escapeHtml(r.badge) + '</span>';
    }
    if (r.originalPrice) {
      var origVal = parseFloat(String(r.originalPrice).replace(/[^0-9.]/g, ''));
      var saleVal = parseFloat(String(r.price).replace(/[^0-9.]/g, ''));
      if (!isNaN(origVal) && !isNaN(saleVal) && origVal > saleVal) {
        var savePct = Math.round((origVal - saleVal) / origVal * 100);
        badgeHtml +=
          '<span class="resource-detail__badge" style="right:14px; left:auto; background:#F9A825;">Save ' + savePct + '%</span>';
      }
    }

    // ── Full checklist (nothing truncated) ───────────────────────────────
    var checklistHtml = parsed.checklist.length
      ? '<ul class="resource-detail__checklist">' + parsed.checklist.map(function (item) {
          return '<li><span class="check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none">' +
            '<path d="M2 5l2 2 4-4" stroke="var(--green-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
            escapeHtml(item) + '</li>';
        }).join('') + '</ul>'
      : '';

    // ── Price ─────────────────────────────────────────────────────────────
    var priceHtml;
    var origFormatted = formatPrice(r.originalPrice);
    if (origFormatted) {
      priceHtml =
        '<div style="display:flex; flex-direction:column; line-height:1.2;">' +
        '<span style="font-size:0.85rem; color:#9e9e9e; text-decoration:line-through;">' + escapeHtml(origFormatted) + '</span>' +
        '<span><span style="font-size:1.4rem; font-weight:700; color:#1C4A30;">' + escapeHtml(formatPrice(r.price)) + '</span>' +
        '<span style="font-size:0.82rem; font-weight:600; color:#6b7280;"> / user</span></span>' +
        '</div>';
    } else {
      priceHtml =
        '<span style="font-size:1.4rem; font-weight:700; color:#1C4A30;">' +
        escapeHtml(formatPrice(r.price)) + '</span>' +
        '<span style="font-size:0.82rem; font-weight:600; color:#6b7280;"> / user</span>';
    }

    var previewHtml = r.previewFile
      ? '<a href="' + escapeHtml(r.previewFile) + '" target="_blank" style="text-align:center; background:#fff; color:#1C4A30; border:1px solid #1C4A30; padding:10px 18px; border-radius:8px; font-size:0.9rem; font-weight:600; text-decoration:none;">Preview ↗</a>'
      : '';

    // ── Team & Site Licensing — native <details> disclosure ────────────────
    var licensingHtml = '';
    if (r.pricingTiers.length) {
      licensingHtml =
        '<details class="resource-licensing">' +
        '<summary><span>Team &amp; Site Licensing</span>' +
        '<svg class="chevron" width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</summary>' +
        '<div class="resource-licensing__tiers">' +
        r.pricingTiers.map(function (tier) {
          return (
            '<div class="resource-licensing__tier">' +
            '<div><strong>' + escapeHtml(tier.label || '') + '</strong>' +
            (tier.range ? '<span style="color:#6b7280;"> — ' + escapeHtml(tier.range) + '</span>' : '') + '</div>' +
            '<span style="font-weight:700; color:#1C4A30; white-space:nowrap;">' + escapeHtml(formatPrice(tier.price)) + '</span>' +
            '</div>'
          );
        }).join('') +
        '</div>' +
        '</details>';
    }

    var reverseClass = (index % 2 === 1) ? ' resource-detail--reverse' : '';

    return (
      '<div class="resource-detail' + reverseClass + '"' +
      ' data-audience="' + escapeHtml(aud) + '"' +
      ' data-category="' + escapeHtml(cat) + '"' +
      ' data-title="' + escapeHtml(titleLower) + '"' +
      ' data-tags="' + escapeHtml(searchTags) + '">' +
      '<div class="resource-detail__visual">' + badgeHtml + imgHtml + '</div>' +
      '<div class="resource-detail__content">' +
      '<h2>' + escapeHtml(r.title) + '</h2>' +
      (parsed.intro ? '<p>' + escapeHtml(parsed.intro) + '</p>' : '') +
      checklistHtml +
      (parsed.outro ? '<p>' + escapeHtml(parsed.outro) + '</p>' : '') +
      '<div class="resource-detail__price-row">' +
      '<div>' + priceHtml + '</div>' +
      '<div class="resource-detail__actions">' + previewHtml +
      '<a href="' + escapeHtml(r.url) + '" target="_blank" style="text-align:center; background:#1C4A30; color:#fff; padding:11px 20px; border-radius:8px; font-size:0.9rem; font-weight:600; text-decoration:none;">Buy Now ↗</a>' +
      '</div>' +
      '</div>' +
      licensingHtml +
      '</div>' +
      '</div>'
    );
  }

  /**
   * Pulls a short intro sentence and a "✅ item" checklist out of a resource
   * description, so the homepage can present it like a service block instead
   * of a shop card. Falls back gracefully when the description has no
   * checklist — the intro just becomes the whole description.
   */
  function parseResourceHighlights(description) {
    var lines = String(description || '')
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
    var introLines = [];
    var checklist = [];
    var seenChecklist = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^✅/.test(line)) {
        seenChecklist = true;
        checklist.push(line.replace(/^✅\s*/, ''));
      } else if (!seenChecklist) {
        if (/^what.?s inside\??$/i.test(line)) continue;
        introLines.push(line);
      } else {
        break; // stop at the first non-checklist line once the checklist has started
      }
    }
    return { intro: introLines.join(' '), checklist: checklist.slice(0, 6) };
  }

  function buildResourceFeatureBlock(resource, index) {
    var r = normalizeResource(resource);
    if (!r || !r.title) return '';
    var parsed = parseResourceHighlights(r.description);

    var imgHtml = r.image
      ? '<img src="' + escapeHtml(r.image) + '" alt="' + escapeHtml(r.title) +
        '" loading="lazy" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:12px;" />'
      : '<div style="color:#90a89a;">' + SVG_PLACEHOLDER + '</div>';

    var badgeHtml = r.badge
      ? '<span class="resource-feature__badge">' + escapeHtml(r.badge) + '</span>'
      : '';

    var checklistHtml = parsed.checklist.length
      ? '<ul class="resource-feature-includes">' + parsed.checklist.map(function (item) {
          return '<li><span class="check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none">' +
            '<path d="M2 5l2 2 4-4" stroke="var(--green-dark)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
            escapeHtml(item) + '</li>';
        }).join('') + '</ul>'
      : '';

    var reverseClass = (index % 2 === 1) ? ' resource-feature--reverse' : '';

    return (
      '<div class="resource-feature' + reverseClass + '">' +
      '<div class="resource-feature__visual">' + badgeHtml + imgHtml + '</div>' +
      '<div class="resource-feature__content">' +
      '<h2>' + escapeHtml(r.title) + '</h2>' +
      (parsed.intro ? '<p>' + escapeHtml(parsed.intro) + '</p>' : '') +
      checklistHtml +
      '</div>' +
      '</div>'
    );
  }

  /**
   * Like parseResourceHighlights, but keeps every checklist item and any
   * trailing paragraphs after the checklist instead of dropping them — used
   * for the expanded product modal where nothing should be cut short.
   */
  function parseResourceFull(description) {
    var lines = String(description || '')
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
    var introLines = [];
    var checklist = [];
    var outroLines = [];
    var seenChecklist = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^✅/.test(line)) {
        seenChecklist = true;
        checklist.push(line.replace(/^✅\s*/, ''));
      } else if (!seenChecklist) {
        if (/^what.?s inside\??$/i.test(line)) continue;
        introLines.push(line);
      } else {
        outroLines.push(line);
      }
    }
    return { intro: introLines.join(' '), checklist: checklist, outro: outroLines.join(' ') };
  }

  function parseFrontmatterMarkdown(text) {
    var result = { meta: {}, body: text || '', raw: text || '' };
    if (!text || typeof text !== 'string') return result;
    text = text.replace(/^\uFEFF/, '');
    var m = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
    if (!m) {
      result.body = text;
      return result;
    }
    var fm = m[1];
    result.body = m[2] || '';
    fm.split(/\r?\n/).forEach(function (line) {
      var idx = line.indexOf(':');
      if (idx === -1) return;
      var key = line.slice(0, idx).trim();
      var val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result.meta[key] = val;
    });
    return result;
  }

  function parseBlogMeta(meta, slug) {
    var published = meta.published;
    var pubStr = published != null ? String(published).toLowerCase().trim() : '';
    if (published === false || pubStr === 'false' || pubStr === 'no' || pubStr === '0') return null;
    var archived = meta.archived;
    var archStr = archived != null ? String(archived).toLowerCase().trim() : '';
    if (archived === true || archStr === 'true' || archStr === 'yes' || archStr === '1') return null;
    var title = meta.title || slug;
    var dateRaw = meta.date || '';
    var t = Date.parse(dateRaw);
    if (isNaN(t)) t = 0;
    var summary = meta.summary || '';
    var image = meta.image || '';
    var featured = meta.featured;
    var featStr = featured != null ? String(featured).toLowerCase().trim() : '';
    return {
      slug: slug,
      title: title,
      date: new Date(t),
      dateRaw: dateRaw,
      summary: summary,
      image: image,
      sortKey: t,
      featured: !(featured === false || featStr === 'false' || featStr === 'no' || featStr === '0'),
    };
  }

  function formatBlogDate(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  }

  function blogArticleUrl(slug) {
    return '/blog-post/?post=' + encodeURIComponent(slug);
  }

  function blogRowHtml(post) {
    var imgInner = ARTICLE_ICON_SVG;
    if (post.image) {
      imgInner =
        '<img src="' +
        escapeHtml(post.image) +
        '" alt="" loading="lazy" width="320" height="200"/>';
    }
    var dateStr = formatBlogDate(post.date);
    return (
      '<article class="article-row" id="post-' +
      escapeHtml(post.slug) +
      '">' +
      '<div class="article-row__img">' +
      imgInner +
      '</div>' +
      '<div>' +
      '<div class="article-row__date">' +
      DATE_ICON_MEDIUM +
      escapeHtml(dateStr) +
      '</div>' +
      '<h2>' +
      escapeHtml(post.title) +
      '</h2>' +
      '<p>' +
      escapeHtml(post.summary) +
      '</p>' +
      '<a href="' +
      blogArticleUrl(post.slug) +
      '" class="read-more">Read More →</a>' +
      '</div></article>'
    );
  }

  function blogMiniHtml(post) {
    var imgInner = ARTICLE_ICON_SVG;
    if (post.image) {
      imgInner =
        '<img src="' +
        escapeHtml(post.image) +
        '" alt="" loading="lazy" width="400" height="240"/>';
    }
    var dateStr = formatBlogDate(post.date);
    return (
      '<div class="article-mini" id="post-' +
      escapeHtml(post.slug) +
      '">' +
      '<div class="article-mini__img">' +
      imgInner +
      '</div>' +
      '<span class="article-mini__date">' +
      DATE_ICON_SMALL +
      escapeHtml(dateStr) +
      '</span>' +
      '<h3>' +
      escapeHtml(post.title) +
      '</h3>' +
      '<p>' +
      escapeHtml(post.summary) +
      '</p>' +
      '<a href="' +
      blogArticleUrl(post.slug) +
      '" class="read-more">Read More →</a>' +
      '</div>'
    );
  }

  function sortPostsDesc(posts) {
    return posts.slice().sort(function (a, b) {
      return b.sortKey - a.sortKey;
    });
  }

  async function loadResourceFilesList() {
    var entries = await listRepoFolder('docs/_data/resources');
    if (!Array.isArray(entries) || !entries.length) return [];
    return entries
      .filter(function (e) {
        return e.type === 'file' && e.name && /\.json$/i.test(e.name);
      })
      .map(function (e) {
        return e.name;
      });
  }

  async function loadResourceFilesFromManifest() {
    var data = await fetchJson('/_data/resources/manifest.json');
    if (!data || !Array.isArray(data.files)) return [];
    return data.files
      .map(function (name) { return String(name || '').replace(/^.*[/\\]/, '').trim(); })
      .filter(function (name) { return name && /\.json$/i.test(name) && name !== 'manifest.json'; });
  }

  async function loadResourceNames() {
    var man = await loadResourceFilesFromManifest();
    if (man.length) return man;
    return loadResourceFilesList();
  }

  async function loadBlogFilenamesFromGithub() {
    var entries = await listRepoFolder('docs/_data/blog');
    if (!Array.isArray(entries) || !entries.length) return [];
    return entries
      .filter(function (e) {
        return e.type === 'file' && e.name && /\.md$/i.test(e.name);
      })
      .map(function (e) {
        return e.name;
      });
  }

  async function loadBlogFilenamesFromManifest() {
    var data = await fetchJson('/_data/blog/manifest.json');
    if (!data || !Array.isArray(data.files)) return [];
    return data.files
      .map(function (name) {
        return String(name || '')
          .replace(/^.*[/\\]/, '')
          .trim();
      })
      .filter(function (name) {
        return name && /\.md$/i.test(name);
      });
  }

  async function loadBlogFilenames() {
    // Manifest is the canonical source (updated by CI on every push).
    // Only fall back to the GitHub API if the manifest is unavailable or empty,
    // so a rename never produces duplicates while the API cache catches up.
    var man = await loadBlogFilenamesFromManifest();
    if (man.length) return man;
    var gh = await loadBlogFilenamesFromGithub();
    return gh;
  }

  async function loadResources() {
    var names = await loadResourceNames();
    if (!names.length) return [];
    var results = await Promise.all(names.map(function (name) {
      return fetchJson('/_data/resources/' + encodeURIComponent(name))
        .then(function (json) {
          return (json && typeof json === 'object') ? Object.assign({ _filename: name }, json) : null;
        });
    }));
    var resources = results.filter(function(r) { return r && r.published !== false && r.archived !== true; });
    resources.sort(function (a, b) {
      var d = (b.createdAt || '').localeCompare(a.createdAt || '');
      if (d !== 0) return d;
      return (b._filename || '').localeCompare(a._filename || '');
    });
    return resources;
  }

  async function loadBlogPostsParsed() {
    var names = await loadBlogFilenames();
    if (!names.length) return [];
    var posts = [];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var slug = name.replace(/\.md$/i, '');
      var path = '/_data/blog/' + encodeURIComponent(name);
      var text = await fetchText(path);
      if (!text) continue;
      var parsed = parseFrontmatterMarkdown(text);
      var post = parseBlogMeta(parsed.meta, slug);
      if (post) posts.push(post);
    }
    return sortPostsDesc(posts);
  }

  async function loadBlogArticlePage() {
    var params = new URLSearchParams(window.location.search);
    var slug = (params.get('post') || '').trim();
    if (!slug && window.location.hash) {
      slug = window.location.hash.replace(/^#/, '').replace(/^post-/, '').trim();
    }
    if (slug.indexOf('%') !== -1) {
      try {
        slug = decodeURIComponent(slug);
      } catch (e1) {
        /* keep slug */
      }
    }
    slug = String(slug).trim();
    if (/[/\\]|\.\./.test(slug)) slug = '';

    var loading = document.getElementById('blog-post-loading');
    var content = document.getElementById('blog-post-content');
    var errEl = document.getElementById('blog-post-error');

    function showError() {
      if (loading) loading.classList.add('hidden');
      if (content) content.classList.add('hidden');
      if (errEl) errEl.classList.remove('hidden');
    }

    if (!slug) {
      showError();
      return;
    }

    var mdPath = '/_data/blog/' + encodeURIComponent(slug) + '.md';
    var text = await fetchText(mdPath);
    if (!text) {
      showError();
      return;
    }

    var parsed = parseFrontmatterMarkdown(text);
    var post = parseBlogMeta(parsed.meta, slug);
    if (!post) {
      showError();
      return;
    }

    var bodyHtml = renderMarked(parsed.body || '');

    document.title = post.title + ' — Blog — Inclusive Intervention Hub';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && post.summary) metaDesc.setAttribute('content', post.summary);

    var titleEl = document.getElementById('blog-post-title');
    if (titleEl) titleEl.textContent = post.title;

    var dateEl = document.getElementById('blog-post-date');
    if (dateEl) dateEl.textContent = formatBlogDate(post.date);

    var summaryEl = document.getElementById('blog-post-summary');
    if (summaryEl) {
      if (post.summary) {
        summaryEl.textContent = post.summary;
        summaryEl.classList.remove('hidden');
      } else {
        summaryEl.textContent = '';
        summaryEl.classList.add('hidden');
      }
    }

    var coverFig = document.getElementById('blog-post-cover');
    if (coverFig) {
      if (post.image) {
        coverFig.innerHTML =
          '<img src="' +
          escapeHtml(post.image) +
          '" alt="" loading="lazy" width="720" height="400"/>';
        coverFig.classList.remove('hidden');
      } else {
        coverFig.innerHTML = '';
        coverFig.classList.add('hidden');
      }
    }

    var bodyEl = document.getElementById('blog-post-body');
    if (bodyEl) bodyEl.innerHTML = bodyHtml;

    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');

    // Initialise Cusdis with the current post's info
    var cusdisEl = document.getElementById('cusdis_thread');
    if (cusdisEl) {
      cusdisEl.setAttribute('data-page-id', post.slug || slug);
      cusdisEl.setAttribute('data-page-url', window.location.href);
      cusdisEl.setAttribute('data-page-title', post.title || '');
      if (window.CUSDIS) window.CUSDIS.initial();
    }
  }

  function loadHomepage() {
    // Kick off all fetches in parallel — don't wait for homepage.json before loading products/blog
    var dataPromise      = fetchJson('/_data/homepage.json');
    var resourcesPromise = loadResources();
    var blogPromise      = (document.getElementById('blog-posts-container')) ? loadBlogPostsParsed() : Promise.resolve([]);

    dataPromise.then(function (data) {
      if (data) applyDataCmsFields(document, data);
    });

    var feat = document.getElementById('featured-resources-container');
    if (feat) {
      resourcesPromise.then(function (resources) {
        var section = document.getElementById('homepage-resources-section');
        if (!resources.length) {
          if (section) section.style.display = 'none';
          return;
        }
        var featured = resources.filter(function (r) {
          return normalizeResource(r).featured;
        });
        if (!featured.length) featured = resources;
        var html = featured.map(function (r, i) {
          return buildResourceFeatureBlock(r, i);
        }).join('');
        if (html) feat.innerHTML = html;
      });
    }

    var blogEl = document.getElementById('blog-posts-container');
    if (blogEl) {
      blogPromise.then(function (posts) {
        var section = document.getElementById('homepage-articles-section');
        if (!posts.length) {
          if (section) section.style.display = 'none';
          return;
        }
        var featured = posts.filter(function (p) { return p.featured; });
        if (!featured.length) featured = posts;
        var top = featured.slice(0, 3);
        var html = top.map(blogMiniHtml).join('');
        if (html) blogEl.innerHTML = html;
      });
    }
  }

  function loadAbout() {
    fetchJson('/_data/about.json').then(function (data) {
      if (!data) return;
      applyDataCmsFields(document, data);
      var y = document.querySelector('[data-cms="years_experience"]');
      if (y) {
        if (data.years_experience && String(data.years_experience).trim() !== '') {
          y.classList.remove('hidden');
        } else {
          y.classList.add('hidden');
        }
      }
    });
  }

  function loadContact() {
    fetchJson('/_data/contact.json').then(function (data) {
      if (!data) return;
      applyDataCmsFields(document, data);
      hideEmptySocial(document, data, ['instagram', 'facebook']);
    });
  }

  async function loadResourcesShopGrid() {
    var grid = document.getElementById('shop-resources-container');
    if (!grid) return;
    var resources = await loadResources();
    if (!resources.length) return;
    var html = resources
      .map(function (r, i) {
        return buildResourceDetailBlock(r, i);
      })
      .join('');
    if (html) {
      // Prepend CMS products before the existing static products (don't replace them)
      grid.insertAdjacentHTML('afterbegin', html);
      document.dispatchEvent(new CustomEvent('cms:shop-ready'));
    }
  }

  window.loadHomepage = loadHomepage;
  window.loadAbout = loadAbout;
  window.loadContact = loadContact;
  window.loadResources = loadResources;

  window.loadBlogPosts = function () {
    return loadBlogPostsParsed();
  };

  window.loadResourcesShopGrid = loadResourcesShopGrid;

  async function syncResourcesNav() {
    var dropdown = document.getElementById('shopDropdown');
    var footerItem = document.getElementById('footerResourcesLi');
    if (!dropdown && !footerItem) return;
    var resources = await loadResources();
    if (!resources.length) {
      if (dropdown) dropdown.style.display = 'none';
    } else if (footerItem) {
      footerItem.style.display = '';
    }
  }

  async function syncBlogNav() {
    var navItem = document.getElementById('navBlogLi');
    var footerItem = document.getElementById('footerBlogLi');
    if (!navItem && !footerItem) return;
    var posts = await loadBlogPostsParsed();
    if (posts.length) {
      if (navItem) navItem.style.display = '';
      if (footerItem) footerItem.style.display = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncResourcesNav();
    syncBlogNav();

    var path = window.location.pathname.replace(/\/+$/, '') || '/';
    var base = (path.split('/').pop() || '').toLowerCase();

    if (!base || base === 'index.html') loadHomepage();
    else if (base === 'about' || base === 'about.html') loadAbout();
    else if (base === 'contact' || base === 'contact.html') loadContact();
    else if (base === 'shop' || base === 'shop.html') loadResourcesShopGrid();
    else if (base === 'blog' || base === 'blog.html') {
      var legacyHash = window.location.hash.replace(/^#/, '');
      if (legacyHash.indexOf('post-') === 0) {
        var legacySlug = legacyHash.slice('post-'.length).trim();
        if (legacySlug && !/[\/\\]|\.\./.test(legacySlug)) {
          window.location.replace('./blog-post.html?post=' + encodeURIComponent(legacySlug));
          return;
        }
      }
      window.loadBlogPosts().then(function (posts) {
        var container = document.getElementById('blog-listing-container');
        if (!container || !posts.length) return;
        // If static pre-rendered cards are already in the HTML, skip JS injection
        // entirely — no swap, no flash, no glitch possible.
        if (container.querySelector('article')) return;
        var html = posts.map(blogRowHtml).join('');
        if (html) container.innerHTML = html;
      });
    } else if (base === 'blog-post.html' || base === 'blog-post') {
      loadBlogArticlePage();
    }
  });
})();
