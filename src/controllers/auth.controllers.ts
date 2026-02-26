import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_SECRET,
  TOKEN_EXPIRE,
  REFRESH_TOKEN_SECRET,
} from "../config/jwt";

interface jwtUserPayload {
  //tentative
  username: string;
  role: string;
}

interface AuthRequest extends Request {
  user?: jwtUserPayload;
}

//Login
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = req.body;
    const userExists = await prisma.users.findUnique({ where: { username } });
    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    //for hashing
    // const passValid = await bcrypt.compare(password, userExists.password_hash);
    // if(!passValid){
    //     return res.status(401).json({ error: "Invalid password" });
    // }

    if (password !== userExists.password_hash) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const payload: jwtUserPayload = {
      username: userExists.username,
      role: userExists.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET);

    await prisma.users.update({
      where: { username: username },
      data: {
        refresh_token: refreshToken,
      },
    });


    //here we send the access token to the user to store it in the local project
    //we also send send the refresh token to the user to store it in the cookioes
    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

//Logout
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //{token: "fdsaljowirnfon"}
    const refreshToken = req.body.token;
    if (!refreshToken) {
      return res.status(403).json({ message: "You don't have refresh token" });
    }

    const decoded = jwt.verify(
      refreshToken,
      REFRESH_TOKEN_SECRET
    ) as jwtUserPayload;
    const username = decoded.username;
    const user = await prisma.users.findUnique({ where: { username } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.refresh_token?.trim() !== refreshToken.trim()) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    await prisma.users.update({
      where: { username },
      data: { refresh_token: null },
    });

    return res.status(200).json({message: "You logged out"});
  } catch (err){
    next(err);
  }
};

//Refresh Access Token
export const refreshAccessToken = async(
    req:Request,
    res: Response,
    next: NextFunction
)=>{
    try{
        //{token: "fdsaljowirnfon"}
        const refreshToken = req.body.token;
        if(!refreshToken){
            return res.status(401).json({message:"Refresh token required"});
        }

        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as jwtUserPayload;
        const username = decoded.username;
        const user = await prisma.users.findUnique({where: {username}});

        if(!user){
            return res.status(404).json({message:"User not found"});
        }

        if(refreshToken !== user.refresh_token){
            return res.status(403).json({ message: "Invalid refresh token" });
        }

        const payload: jwtUserPayload = {
            username: user.username,
            role: user.role
        }

        //here we send the access token to the user to store it in the local project
        const accessToken = generateAccessToken(payload);
        return res.status(200).json({token:accessToken});
    }catch(err){
        next(err);
    }
}

// Access Token Generator
function generateAccessToken(payload: jwtUserPayload) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: TOKEN_EXPIRE as any,
  });
}
