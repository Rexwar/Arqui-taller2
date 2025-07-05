const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const createProxyRoutes = () => {
    const router = express.Router();

    const services = [

        { route: '/playlists', target: process.env.PLAYLIST_SERVICE_URL || 'http://playlist-service:3002' },
        { route: '/videos', target: process.env.VIDEO_SERVICE_URL || 'http://video-service:3003' },
        { route: '/billing', target: process.env.BILLING_SERVICE_URL || 'http://billing-service:3005' },
        { route: '/monitoring', target: process.env.MONITORING_SERVICE_URL || 'http://monitoring-service:3006' },
        { route: '/social', target: process.env.SOCIAL_SERVICE_URL || 'http://social-service:3004' },
        { route: '/email', target: process.env.EMAIL_SERVICE_URL || 'http://email-service:3007' } // Added Email Service
    ];

    services.forEach(({ route, target }) => {
        router.use(route, createProxyMiddleware({
            target,
            changeOrigin: true,
            onError: (err, req, res) => {
                console.error(`Proxy error for ${route}:`, err);
                res.status(500).send('Proxy error');
            }
        }));
    });

    return router;
};

module.exports = createProxyRoutes;
