/**
 * Inclusive Materials — CMS content loader (Sveltia / Git-backed JSON & Markdown)
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
    };
  }

  function formatPrice(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (s.charAt(0) === '$') return s;
    var n = parseFloat(s);
    if (isNaN(n)) return s;
    return '$' + n.toFixed(2);
  }

  function buildProductCard(resource, opts) {
    var r = normalizeResource(resource);
    if (!r || !r.title) return '';

    // audience can be a single value ("ot") or space-separated multi-value ("ot speech")
    var aud = String(r.audience || 'all').toLowerCase().trim();
    // Use the first listed audience for chip colour; full string goes into data-audience
    var primaryAud = aud.split(/\s+/)[0] || 'all';
    var cat = String(r.category || 'all').toLowerCase().trim();
    var titleLower = r.title.toLowerCase();
    var searchTags = String(r.searchTags || '').toLowerCase();

    // ── Image (with object-position:top) ──────────────────────────────────
    var imgHtml;
    if (r.image) {
      imgHtml =
        '<img src="' + escapeHtml(r.image) + '" alt="' + escapeHtml(r.title) +
        '" loading="lazy" style="width:100%; height:220px; object-fit:cover; object-position:top; display:block;" />';
    } else {
      imgHtml =
        '<div style="width:100%; height:220px; background:#f0f7f3; display:flex; align-items:center; justify-content:center; color:#90a89a;">' +
        SVG_PLACEHOLDER + '</div>';
    }

    // ── Badge — absolutely positioned over image ───────────────────────────
    var badgeHtml = '';
    if (r.badge) {
      var bl = r.badge.toLowerCase();
      var bColor = (bl === 'bundle' || bl === 'sale') ? '#E53935'
                 : (bl === 'featured' || bl === 'popular' || bl === 'best seller') ? '#F9A825'
                 : '#00897B';
      badgeHtml =
        '<span style="position:absolute; top:10px; left:10px; background:' + bColor +
        '; color:#fff; font-size:0.75rem; font-weight:700; padding:4px 10px; border-radius:20px;">' +
        escapeHtml(r.badge) + '</span>';
    }

    // ── Audience / category tag chips ──────────────────────────────────────
    var audLabel, chipStyle;
    if (primaryAud === 'speech') {
      audLabel = 'Speech &amp; Language';
      chipStyle = 'background:#E8F5E9; color:#2E7D32;';
    } else if (primaryAud === 'ot') {
      audLabel = 'OT';
      chipStyle = 'background:#E0F2F1; color:#00695C;';
    } else if (primaryAud === 'sped') {
      audLabel = 'SPED';
      chipStyle = 'background:#FFF3E0; color:#E65100;';
    } else {
      audLabel = 'General Education';
      chipStyle = 'background:#F3E5F5; color:#6A1B9A;';
    }
    var chipBase = 'font-size:0.7rem; font-weight:600; padding:3px 8px; border-radius:12px;';
    var tagsHtml = '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">' +
      '<span style="' + chipStyle + ' ' + chipBase + '">' + audLabel + '</span>';
    if (cat && cat !== 'all') {
      var catLabel = cat.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      tagsHtml += '<span style="' + chipStyle + ' ' + chipBase + '">' + escapeHtml(catLabel) + '</span>';
    }
    tagsHtml += '</div>';

    // ── Price (formatted) ─────────────────────────────────────────────────
    var priceHtml =
      '<span style="font-size:1.2rem; font-weight:700; color:#1C4A30;">' +
      escapeHtml(formatPrice(r.price)) + '</span>';

    return (
      '<div class="product-card"' +
      ' data-audience="' + escapeHtml(aud) + '"' +
      ' data-category="' + escapeHtml(cat) + '"' +
      ' data-title="' + escapeHtml(titleLower) + '"' +
      ' data-tags="' + escapeHtml(searchTags) + '"' +
      ' style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">' +
      '<div style="position:relative;">' +
      imgHtml +
      badgeHtml +
      '</div>' +
      '<div style="padding:16px;">' +
      tagsHtml +
      '<h3 style="font-size:1rem; font-weight:700; color:#1C4A30; margin-bottom:6px; line-height:1.4;">' + escapeHtml(r.title) + '</h3>' +
      '<p style="font-size:0.85rem; color:#546E7A; margin-bottom:12px; line-height:1.5;">' + escapeHtml(r.description) + '</p>' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      priceHtml +
      '<a href="' + escapeHtml(r.url) + '" target="_blank"' +
      ' style="background:#1C4A30; color:#fff; padding:8px 16px; border-radius:8px; font-size:0.85rem; font-weight:600; text-decoration:none;">Buy Now ↗</a>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
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
    var title = meta.title || slug;
    var dateRaw = meta.date || '';
    var t = Date.parse(dateRaw);
    if (isNaN(t)) t = 0;
    var summary = meta.summary || '';
    var image = meta.image || '';
    return {
      slug: slug,
      title: title,
      date: new Date(t),
      dateRaw: dateRaw,
      summary: summary,
      image: image,
      sortKey: t,
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
    var names = await loadResourceFilesList();
    if (!names.length) return [];
    var resources = [];
    for (var i = 0; i < names.length; i++) {
      var path = '/_data/resources/' + encodeURIComponent(names[i]);
      var json = await fetchJson(path);
      if (json && typeof json === 'object') resources.push(json);
    }
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

    document.title = post.title + ' — Blog — Inclusive Materials';
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
  }

  function loadHomepage() {
    fetchJson('/_data/homepage.json').then(function (data) {
      if (data) applyDataCmsFields(document, data);
      var feat = document.getElementById('featured-resources-container');
      if (feat) {
        loadResources().then(function (resources) {
          if (!resources.length) return;
          var featured = resources.filter(function (r) {
            return normalizeResource(r).featured;
          });
          if (!featured.length) featured = resources;
          var html = featured.map(function (r) {
            return buildProductCard(r, { includeTags: true });
          }).join('');
          if (html) feat.innerHTML = html;
        });
      }

      var blogEl = document.getElementById('blog-posts-container');
      if (blogEl) {
        loadBlogPostsParsed().then(function (posts) {
          if (!posts.length) return;
          var top = posts.slice(0, 3);
          var html = top.map(blogMiniHtml).join('');
          if (html) blogEl.innerHTML = html;
        });
      }
    });
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
      hideEmptySocial(document, data, ['instagram', 'facebook', 'pinterest']);
    });
  }

  async function loadResourcesShopGrid() {
    var grid = document.getElementById('shop-resources-container');
    if (!grid) return;
    var resources = await loadResources();
    if (!resources.length) return;
    var html = resources
      .map(function (r) {
        return buildProductCard(r, { includeTags: true });
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

  document.addEventListener('DOMContentLoaded', function () {
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
        var html = posts.map(blogRowHtml).join('');
        if (html) {
          container.innerHTML = html;
          // Fade in smoothly — CSS starts container at opacity:0
          requestAnimationFrame(function () {
            container.style.opacity = '1';
          });
        }
      });
    } else if (base === 'blog-post.html' || base === 'blog-post') {
      loadBlogArticlePage();
    }
  });
})();
