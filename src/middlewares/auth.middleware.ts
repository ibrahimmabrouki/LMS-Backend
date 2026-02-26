import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_SECRET, TOKEN_EXPIRE } from "../config/jwt";

import jwtUserPayload from "../utils/jwtUserPayload";
import { decode } from "punycode";

interface AuthRequest extends Request{
    user?: jwtUserPayload;
}


//middleware to authenticate the user access after that we are going to get the username of the user
//from what we have added in the body user (jwtUserPayload)
export const authenticateToken = (
    req: AuthRequest,
    res: Response,
    next : NextFunction
)=>{
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).json({message: "You should login"});
    }

    const token = authHeader.split(" ")[1];

    if(!token){
        return res.status(401).json({message: " Invalid token format"});
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
            return res.status(403).json({message: "You dont have access"});
        }
        req.user = decoded as jwtUserPayload;
        next();
    });
}