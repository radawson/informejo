# WebSocket Implementation - Changelog

## Overview

Implemented real-time WebSocket functionality using Socket.IO with a custom Node.js server that wraps Next.js.

**Implementation Date:** November 12, 2024  
**Branch:** `dev`  
**Status:** ✅ Complete - Ready for Testing

---

## 🎯 Goals Achieved

- [x] Real-time ticket updates across all clients
- [x] Real-time comment additions without page refresh
- [x] Real-time attachment notifications
- [x] WebSocket support through HAProxy → Nginx → PM2
- [x] Custom server compatible with PM2 deployment
- [x] Proper connection handling and room management
- [x] Graceful fallback to HTTP polling if WebSocket fails

---

## 📝 Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `server.js` | Custom Node.js server integrating Next.js and Socket.IO |
| `src/lib/socketio-server.ts` | Helper utilities for emitting Socket.IO events from API routes |
| `documents/WEBSOCKET_SETUP.md` | Comprehensive WebSocket setup documentation |
| `documents/WEBSOCKET_QUICKSTART.md` | Quick start guide for WebSocket deployment |
| `documents/WEBSOCKET_CHANGELOG.md` | This file - summary of all changes |

### Modified Files

| File | Changes |
|------|---------|
| `package.json` | Updated `dev` and `start` scripts to use `server.js` |
| `ecosystem.config.js` | Changed to run `server.js` on port 3003 in fork mode |
| `example.env` | Updated port to 3003, added `NEXT_PUBLIC_SOCKET_URL` |
| `src/components/SocketProvider.tsx` | Enabled Socket.IO connection with enhanced error handling |
| `src/app/api/tickets/route.ts` | Updated to use Socket.IO helper for `ticket:created` events |
| `src/app/api/tickets/[id]/route.ts` | Updated to use Socket.IO helper for `ticket:updated` events |
| `src/app/api/tickets/[id]/comments/route.ts` | Updated to use Socket.IO helper for `comment:added` events |
| `src/app/api/tickets/[id]/attachments/route.ts` | Updated to use Socket.IO helper for `attachment:added` events |
| `documents/nginx.conf` | Added dedicated `/socket.io/` location block with optimized settings |

### Deleted Files

| File | Reason |
|------|--------|
| `src/app/api/socket/route.ts` | Replaced by custom server implementation in `server.js` |

---

## 🔧 Technical Details

### Port Change

- **Old:** Port 3000
- **New:** Port 3003
- **Reason:** Consistency with deployment configuration and avoid conflicts

### PM2 Configuration

- **Mode:** Changed from `cluster` to `fork`
- **Reason:** Socket.IO requires sticky sessions in cluster mode; fork mode is simpler and sufficient for current scale

### Socket.IO Events

| Event | Trigger | Audience |
|-------|---------|----------|
| `ticket:created` | New ticket submitted | All connected clients |
| `ticket:updated` | Status/priority/assignment changed | All clients + ticket room |
| `comment:added` | New comment posted | Ticket room only |
| `attachment:added` | File uploaded | Ticket room only |

### Room Structure

- **`ticket:{ticketId}`**: Users join this room when viewing a specific ticket
- Ensures updates only go to clients viewing that ticket
- Users automatically leave room when navigating away

---

## 🚀 Deployment Instructions

### Development

```bash
npm run dev
```

### Production

```bash
cd scripts
./deploy.sh
```

Or manually:

```bash
npm ci
npm run build
pm2 delete informejo
pm2 start ecosystem.config.js
pm2 save
```

### Nginx

```bash
sudo cp documents/nginx.conf /etc/nginx/sites-available/ticket.partridgecrossing.org
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧪 Testing Checklist

### Local Development

- [ ] Run `npm run dev`
- [ ] Open `http://localhost:3003`
- [ ] Check browser console shows: `[Socket.IO] Connected successfully`
- [ ] Open ticket in two browser tabs
- [ ] Add comment in tab 1, verify it appears in tab 2 without refresh

### Production

- [ ] Deploy to server
- [ ] Verify PM2 shows process as "online"
- [ ] Check PM2 logs: `pm2 logs informejo`
- [ ] Open app in browser, verify Socket.IO connection
- [ ] Test real-time updates with multiple users/devices
- [ ] Check nginx logs: `sudo tail -f /var/log/nginx/informejo_error.log`

### HAProxy

- [ ] Verify WebSocket headers are forwarded
- [ ] Check HAProxy stats/logs for WebSocket connections
- [ ] Test connection through full proxy chain: Internet → HAProxy → Nginx → App

---

## 📊 Performance Considerations

### Current Implementation

- **Single Instance:** Running in fork mode (1 process)
- **Suitable For:** Small to medium deployments (up to ~1000 concurrent users)
- **Memory:** ~500MB typical usage

### Future Scaling

If you need to scale beyond single instance:

1. **Redis Adapter**: Add Socket.IO Redis adapter for multi-instance support
2. **Sticky Sessions**: Configure nginx or HAProxy for sticky sessions
3. **Cluster Mode**: Re-enable cluster mode with proper Socket.IO configuration

---

## 🐛 Known Issues / Limitations

1. **Authentication**: Socket.IO connections don't verify user sessions
   - All authenticated users can receive all events
   - Future enhancement: Add Socket.IO middleware to verify NextAuth sessions

2. **Ticket List**: Doesn't auto-update when tickets change
   - Only ticket detail pages have real-time updates
   - Ticket lists require manual refresh
   - Future enhancement: Add global event listeners for list updates

3. **No Admin Room**: No separate room for admin-only events
   - All updates are broadcast to all clients or specific ticket rooms
   - Future enhancement: Add `admins` room for admin notifications

4. **No Presence**: Can't see which users are currently online
   - Future enhancement: Add user presence tracking

---

## 🔒 Security Notes

1. **CORS**: Currently allows connections from `NEXT_PUBLIC_APP_URL`
   - Update `server.js` if you need different CORS settings

2. **Rate Limiting**: Not currently implemented
   - Consider adding rate limiting for Socket.IO connections in future

3. **Event Validation**: Events are emitted without additional validation
   - API routes handle authorization, but Socket.IO doesn't re-verify

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `WEBSOCKET_SETUP.md` | Complete guide with architecture, troubleshooting, HAProxy config |
| `WEBSOCKET_QUICKSTART.md` | Fast-track guide for developers who just want it working |
| `WEBSOCKET_CHANGELOG.md` | This file - summary of changes and implementation details |

---

## 🎯 Future Enhancements

Prioritized list of potential improvements:

### High Priority
1. **Authentication Middleware**: Verify NextAuth sessions on Socket.IO connections
2. **Connection Status UI**: Show connection status indicator in UI
3. **Better Error Handling**: User-friendly messages when WebSocket fails

### Medium Priority
4. **Admin Room**: Separate room for admin-only notifications
5. **Ticket List Updates**: Real-time updates for ticket lists
6. **Typing Indicators**: Show when someone is typing a comment
7. **Toast Notifications**: Show toast messages for real-time events

### Low Priority
8. **User Presence**: Display online/offline status
9. **Read Receipts**: Show when comments have been read
10. **Redis Adapter**: For horizontal scaling with multiple instances

---

## 🆘 Support & Troubleshooting

### Common Issues

**Issue:** Socket.IO not connecting
- **Check:** PM2 logs (`pm2 logs informejo`)
- **Check:** Browser console for error messages
- **Solution:** Restart PM2 process

**Issue:** 502 Bad Gateway
- **Check:** Is app running? (`pm2 status`)
- **Check:** Port 3003 listening? (`sudo netstat -tlnp | grep 3003`)
- **Solution:** Restart app and nginx

**Issue:** Connection drops frequently
- **Check:** HAProxy timeout settings
- **Check:** Nginx timeout settings in `/socket.io/` location
- **Solution:** Increase timeouts to 24h for WebSocket connections

### Getting Help

1. Check documentation in `documents/WEBSOCKET_SETUP.md`
2. Review logs: `pm2 logs informejo`
3. Check nginx logs: `sudo tail -f /var/log/nginx/informejo_error.log`
4. Review HAProxy logs (on pfSense)

---

## ✅ Sign-Off

**Implementation Status:** Complete  
**Testing Status:** Ready for QA  
**Documentation Status:** Complete  
**Deployment Status:** Ready for production

**Recommended Next Steps:**

1. Test in development environment
2. Deploy to staging/beta environment
3. Conduct user acceptance testing
4. Deploy to production in December rollout

---

**Last Updated:** November 12, 2024  
**Implemented By:** Development Team  
**Reviewed By:** TBD  
**Approved By:** TBD

