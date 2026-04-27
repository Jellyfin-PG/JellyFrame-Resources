jf.onStart(function() {
    jf.log.info('notify-dispatcher: started');
});

jf.onStop(function() {
    jf.log.info('notify-dispatcher: stopped');
});

/*
  POST /JellyFrame/mods/notify-dispatcher/api/send
  Body:
  {
    "title":   string  (required)
    "body":    string  (required)
    "type":    string  (optional, default "info" -- "info"|"success"|"warning"|"error")
    "target":  string  (optional, default "all")
               "all"               -> broadcast to all connected clients
               "user:<userId>"     -> notify all sessions for a specific user
               "session:<sessionId>" -> notify the single session by its websocket (sendWebSocketMessage)
  }
  Returns:
  {
    "ok": true,
    "notified": <number>   (sessions reached, or 1 for session-targeted, 0 if not found)
  }
*/
jf.routes.post('/send', function(req, res) {
    var body = req.body;

    if (!body || !body.title || !body.body) {
        return res.status(400).json({ error: 'title and body are required' });
    }

    var title  = String(body.title);
    var text   = String(body.body);
    var type   = body.type  ? String(body.type)   : 'info';
    var target = body.target ? String(body.target) : 'all';

    var validTypes = { info: true, success: true, warning: true, error: true };
    if (!validTypes[type]) {
        return res.status(400).json({ error: 'type must be info, success, warning, or error' });
    }

    var payload = {
        title: title,
        body:  text,
        type:  type
    };

    if (target === 'all') {
        var notified = jf.jellyfin.notify(null, payload);
        jf.log.info('notify-dispatcher: broadcast sent, sessions notified: ' + notified);
        return res.json({ ok: true, notified: notified });
    }

    // --- target: "user:<userId>" ---
    if (target.indexOf('user:') === 0) {
        var userId = target.slice(5);
        if (!userId) {
            return res.status(400).json({ error: 'user: target requires a userId after the colon' });
        }
        var user = jf.jellyfin.getUser(userId);
        if (!user) {
            return res.status(404).json({ error: 'user not found: ' + userId });
        }
        var notifiedUser = jf.jellyfin.notify(userId, payload);
        jf.log.info('notify-dispatcher: user notify sent to ' + userId + ', sessions notified: ' + notifiedUser);
        return res.json({ ok: true, notified: notifiedUser });
    }

    // --- target: "session:<sessionId>" ---
    if (target.indexOf('session:') === 0) {
        var sessionId = target.slice(8);
        if (!sessionId) {
            return res.status(400).json({ error: 'session: target requires a sessionId after the colon' });
        }
        var sessions = jf.jellyfin.getSessions() || [];
        var targetSession = null;
        for (var i = 0; i < sessions.length; i++) {
            if (sessions[i].id === sessionId) {
                targetSession = sessions[i];
                break;
            }
        }
        if (!targetSession) {
            return res.status(404).json({ error: 'session not found: ' + sessionId });
        }
        var sessionPayload = {
            title:     title,
            body:      text,
            type:      type,
            sessionId: sessionId
        };
        var notifiedSession = jf.jellyfin.notify(targetSession.userId, sessionPayload);
        jf.log.info('notify-dispatcher: session notify sent to session ' + sessionId + ' (userId ' + targetSession.userId + ')');
        return res.json({ ok: true, notified: notifiedSession });
    }

    return res.status(400).json({ error: 'invalid target. Use "all", "user:<id>", or "session:<id>"' });
});

/*
  GET /JellyFrame/mods/notify-dispatcher/api/sessions
  Returns active sessions so callers can discover sessionIds for targeted notifications.
*/
jf.routes.get('/sessions', function(req, res) {
    var sessions = jf.jellyfin.getSessions() || [];
    var result = [];
    for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        result.push({
            id:         s.id,
            userId:     s.userId,
            userName:   s.userName,
            client:     s.client,
            deviceName: s.deviceName
        });
    }
    return res.json({ sessions: result });
});
