import { Request, Response, NextFunction } from "express";

const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.log("GLOBAL ERROR MIDDLEWARE");
    console.error(err);
    res.status(500).json({ message: err.message });
};

export default errorHandler;
