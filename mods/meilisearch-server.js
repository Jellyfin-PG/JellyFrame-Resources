var MS_URL = jf.vars['MEILISEARCH_URL'];
var MS_KEY = jf.vars['MEILISEARCH_KEY'];
var INDEX  = 'jellyfin';

// How many items to fetch and push per scheduler tick.
// 200 keeps Jint allocations well under budget per tick (~8-10 MB cumulative per batch).
var BATCH_SIZE = 200;

// How often to process a batch during initial indexing (ms).
// 8s gives Meilisearch time to ingest and keeps CPU quiet.
var BULK_INTERVAL_MS = 8000;

var ALLOWED_TYPES = 'Movie,Series,Episode,Audio,MusicAlbum,Book';
var ALLOWED_MAP = {
    'Movie':      true,
    'Series':     true,
    'Episode':    true,
    'Audio':      true,
    'MusicAlbum': true,
    'Book':       true
};

// Store keys
var STORE_OFFSET = 'bulk_offset';  // current pagination offset (string int)
var STORE_DONE   = 'bulk_done';    // '1' once complete
var STORE_TOTAL  = 'bulk_total';   // total items indexed during bulk run

var bulkSchedulerId = null;

function msHeaders() {
    return {
        'Authorization': 'Bearer ' + MS_KEY,
        'Content-Type': 'application/json'
    };
}

function buildDoc(item) {
    return {
        id:             item.id,
        name:           item.name,
        type:           item.type,
        overview:       item.overview || '',
        year:           item.productionYear || null,
        genres:         item.genres || [],
        rating:         item.communityRating || null,
        officialRating: item.officialRating || null,
        seriesName:     item.seriesName || null,
        seasonName:     item.seasonName || null,
        indexNumber:    item.indexNumber || null,
        tags:           item.tags || [],
        primaryTag:     (item.imageTags && item.imageTags.Primary) ? item.imageTags.Primary : null
    };
}

function pushDocs(docs) {
    if (!docs || docs.length === 0) { return; }
    var r = jf.http.post(
        MS_URL + '/indexes/' + INDEX + '/documents',
        JSON.stringify(docs),
        { headers: msHeaders(), timeout: 15000 }
    );
    if (!r.ok) {
        jf.log.warn('meilisearch-sync: push failed ' + r.status + ' ' + r.body);
    }
}

function deleteDoc(itemId) {
    var r = jf.http.delete(
        MS_URL + '/indexes/' + INDEX + '/documents/' + itemId,
        { headers: msHeaders(), timeout: 10000 }
    );
    if (!r.ok) {
        jf.log.warn('meilisearch-sync: delete failed ' + r.status);
    }
}

function ensureIndex() {
    jf.http.post(
        MS_URL + '/indexes',
        JSON.stringify({ uid: INDEX, primaryKey: 'id' }),
        { headers: msHeaders(), timeout: 10000 }
    );
    jf.http.put(
        MS_URL + '/indexes/' + INDEX + '/settings',
        JSON.stringify({
            searchableAttributes: ['name', 'overview', 'seriesName', 'genres', 'tags'],
            filterableAttributes: ['type', 'year', 'genres', 'officialRating'],
            sortableAttributes:   ['year', 'rating'],
            displayedAttributes:  [
                'id', 'name', 'type', 'overview', 'year', 'genres',
                'rating', 'officialRating', 'seriesName', 'seasonName',
                'indexNumber', 'primaryTag'
            ]
        }),
        { headers: msHeaders(), timeout: 10000 }
    );
}

function startBulkIndex() {
    var savedOffset = jf.store.get(STORE_OFFSET);
    var offset = savedOffset ? parseInt(savedOffset, 10) : 0;

    if (offset === 0) {
        jf.log.info('meilisearch-sync: starting initial bulk index.');
    } else {
        jf.log.info('meilisearch-sync: resuming bulk index from offset ' + offset + '.');
    }

    bulkSchedulerId = jf.scheduler.interval(BULK_INTERVAL_MS, function() {
        var items = jf.jellyfin.getItems({
            recursive:  'true',
            limit:      String(BATCH_SIZE),
            startIndex: String(offset),
            type:       ALLOWED_TYPES
        }) || [];

        if (items.length === 0) {
            jf.store.set(STORE_DONE, '1');
            jf.store.set(STORE_OFFSET, '0');
            var total = parseInt(jf.store.get(STORE_TOTAL) || '0', 10);
            jf.log.info('meilisearch-sync: bulk index complete. ' + total + ' items indexed.');
            jf.scheduler.cancel(bulkSchedulerId);
            bulkSchedulerId = null;
            return;
        }

        var docs = [];
        for (var i = 0; i < items.length; i++) {
            docs.push(buildDoc(items[i]));
        }
        pushDocs(docs);

        offset += items.length;
        var running = parseInt(jf.store.get(STORE_TOTAL) || '0', 10) + items.length;
        jf.store.set(STORE_OFFSET, String(offset));
        jf.store.set(STORE_TOTAL, String(running));
        jf.log.info('meilisearch-sync: bulk progress ' + running + ' items indexed...');

        // Fewer than a full batch means this was the last page
        if (items.length < BATCH_SIZE) {
            jf.store.set(STORE_DONE, '1');
            jf.store.set(STORE_OFFSET, '0');
            jf.log.info('meilisearch-sync: bulk index complete. ' + running + ' items indexed.');
            jf.scheduler.cancel(bulkSchedulerId);
            bulkSchedulerId = null;
        }
    });
}

jf.onStart(function() {
    if (!MS_URL || !MS_KEY) {
        jf.log.error('meilisearch-sync: MEILISEARCH_URL or MEILISEARCH_KEY not set. Mod inactive.');
        return;
    }

    ensureIndex();

    var bulkDone = jf.store.get(STORE_DONE);
    if (bulkDone !== '1') {
        // First run or previous run was interrupted - start/resume
        startBulkIndex();
    } else {
        jf.log.info('meilisearch-sync: bulk index already complete. Incremental sync active.');
    }

    jf.jellyfin.on('item.added', function(data) {
        if (!ALLOWED_MAP[data.itemType]) { return; }
        var item = jf.jellyfin.getItem(data.itemId);
        if (item) {
            pushDocs([buildDoc(item)]);
            jf.log.debug('meilisearch-sync: indexed added item ' + data.itemId);
        }
    });

    jf.jellyfin.on('item.updated', function(data) {
        if (!ALLOWED_MAP[data.itemType]) { return; }
        var item = jf.jellyfin.getItem(data.itemId);
        if (item) {
            pushDocs([buildDoc(item)]);
            jf.log.debug('meilisearch-sync: indexed updated item ' + data.itemId);
        }
    });

    jf.jellyfin.on('item.removed', function(data) {
        if (!ALLOWED_MAP[data.itemType]) { return; }
        deleteDoc(data.itemId);
        jf.log.debug('meilisearch-sync: deleted item ' + data.itemId);
    });
});

jf.onStop(function() {
    if (bulkSchedulerId !== null) {
        jf.scheduler.cancel(bulkSchedulerId);
        bulkSchedulerId = null;
    }
    jf.scheduler.cancelAll();
    jf.jellyfin.off('item.added');
    jf.jellyfin.off('item.updated');
    jf.jellyfin.off('item.removed');
    jf.log.info('meilisearch-sync: stopped.');
});

// GET /JellyFrame/mods/meilisearch-sync/api/search?q=...&type=Movie&limit=20
jf.routes.get('/search', function(req, res) {
    var q     = req.query['q'] || '';
    var type  = req.query['type'] || null;
    var limit = parseInt(req.query['limit'] || '20', 10) || 20;

    var body = { q: q, limit: limit };
    if (type && ALLOWED_MAP[type]) {
        body.filter = 'type = "' + type + '"';
    }

    var r = jf.http.post(
        MS_URL + '/indexes/' + INDEX + '/search',
        JSON.stringify(body),
        { headers: msHeaders(), timeout: 10000 }
    );
    if (!r.ok) {
        return res.status(502).json({ error: 'Meilisearch unavailable', status: r.status });
    }
    return res.json(r.json());
});

// GET /JellyFrame/mods/meilisearch-sync/api/stats
// Returns Meilisearch index stats + bulk index progress from store
jf.routes.get('/stats', function(req, res) {
    var r = jf.http.get(
        MS_URL + '/indexes/' + INDEX + '/stats',
        { headers: msHeaders(), timeout: 5000 }
    );
    if (!r.ok) {
        return res.status(502).json({ error: 'Meilisearch unavailable' });
    }
    return res.json({
        meilisearch: r.json(),
        bulkDone:    jf.store.get(STORE_DONE) === '1',
        bulkOffset:  parseInt(jf.store.get(STORE_OFFSET) || '0', 10),
        bulkTotal:   parseInt(jf.store.get(STORE_TOTAL)  || '0', 10)
    });
});

// POST /JellyFrame/mods/meilisearch-sync/api/reindex
// Wipes progress and starts a full reindex from scratch
jf.routes.post('/reindex', function(req, res) {
    jf.store.set(STORE_DONE,   '0');
    jf.store.set(STORE_OFFSET, '0');
    jf.store.set(STORE_TOTAL,  '0');

    if (bulkSchedulerId !== null) {
        jf.scheduler.cancel(bulkSchedulerId);
        bulkSchedulerId = null;
    }

    startBulkIndex();
    return res.json({ ok: true, message: 'Full reindex started.' });
});
