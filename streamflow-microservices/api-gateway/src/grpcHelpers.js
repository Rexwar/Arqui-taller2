const grpc = require('@grpc/grpc-js');

const createMetadata = (req) => {
    const metadata = new grpc.Metadata();
    if (req.userId) metadata.set('x-user-id', String(req.userId));
    if (req.userRole) metadata.set('x-user-role', req.userRole);
    return metadata;
};

const handleGrpcError = (res, error) => {
    console.error('gRPC Error:', error.details || error.message);
    const status = error.code || grpc.status.INTERNAL;
    switch (status) {
        case grpc.status.INVALID_ARGUMENT: return res.status(400).json({ error: error.details });
        case grpc.status.NOT_FOUND: return res.status(404).json({ error: error.details });
        case grpc.status.ALREADY_EXISTS: return res.status(409).json({ error: error.details });
        case grpc.status.PERMISSION_DENIED: return res.status(403).json({ error: error.details });
        case grpc.status.UNAUTHENTICATED: return res.status(401).json({ error: error.details });
        default: return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { createMetadata, handleGrpcError };
