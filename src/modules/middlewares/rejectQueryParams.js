const rejectQueryParams = (req, res, next) => {
    if (Object.keys(req.query).length > 0) {
        return res.status(400).json({
            success: false,
            message:
                'No se permiten query params en este endpoint'
        });
    }

    next();
};

module.exports = rejectQueryParams;